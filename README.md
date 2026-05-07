# Adversarial Defense System

A full-stack research tool for **adversarial machine learning**, demonstrating FGSM attacks and defense via Feature Squeezing on a ResNet50V2 classifier.

---

## What It Does

This system lets you upload any image and watch in real time as:

1. **ResNet50V2** (trained on ImageNet) classifies your image
2. An **FGSM adversarial attack** (Fast Gradient Sign Method) is injected with a configurable epsilon (ε) value, attempting to fool the model
3. A **defense mechanism** (Feature Squeezing or Median Filter) is applied to the attacked image
4. The system computes an **anomaly score** comparing the attacked vs defended prediction distributions to decide if an attack was detected

---

## Features

| Feature | Details |
|---|---|
| Attack | FGSM via TensorFlow GradientTape |
| Defense Option 1 | Feature Squeezing — 5-bit depth reduction |
| Defense Option 2 | Spatial Smoothing — PIL Median Filter |
| Threat Score | 0–100 real-time meter |
| Predictions | Top-5 labels + confidence bars for all 3 stages |
| Image Comparison | Side-by-side: Original / Attacked / Defended |
| Metrics | L1/L2 anomaly score, PSNR (dB), pixel perturbation, processing time |
| History | Last 6 analyses tracked in-session |

---

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────┐
│   Next.js Frontend  │  HTTP   │   Flask Backend (Python) │
│   (React + Tailwind)│◄───────►│   TensorFlow / ResNet50V2│
│   localhost:3000    │  POST   │   localhost:5000         │
└─────────────────────┘         └──────────────────────────┘
```

---

## Setup

### Backend (Python)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The Flask server starts on `http://127.0.0.1:5000`.  
First run downloads ResNet50V2 weights (~100 MB).

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## API Reference

### `POST /analyze`

**Form fields:**

| Field | Type | Description |
|---|---|---|
| `image` | File | Image file (PNG/JPG/WEBP) |
| `strength` | float | FGSM epsilon (0.01 – 0.30) |
| `defense` | string | `"squeeze"` or `"smooth"` |

**Response:**

```json
{
  "status": "CRITICAL: Attack Detected & Neutralized",
  "threat_score": 82,
  "classification_flipped": true,
  "defense_recovered": true,
  "original": { "top5": [{"label": "Labrador", "confidence": 94.2}], "image_b64": "..." },
  "attacked": { "top5": [...], "image_b64": "..." },
  "defended": { "top5": [...], "image_b64": "..." },
  "metrics": {
    "anomaly_score_l1": 1.23,
    "anomaly_score_l2": 0.45,
    "attack_psnr_db": 29.3,
    "recovery_psnr_db": 36.1,
    "pixel_perturbation": 0.049,
    "processing_time_s": 1.84
  }
}
```

### `GET /health`

Returns model status.

---

## How FGSM Works

FGSM (Goodfellow et al., 2014) computes the gradient of the model's loss with respect to the **input image pixels**, then steps in the direction that maximizes the loss:

```
x_adv = x + ε · sign(∇_x J(θ, x, y))
```

Where `ε` controls attack strength. Even at `ε = 0.05` (imperceptible to humans), it can flip classification confidently.

## How Feature Squeezing Works

Feature squeezing (Xu et al., 2018) reduces the input color space by quantizing pixel values to `2^bits` levels. Adversarial perturbations crafted in full precision largely survive JPEG compression but are destroyed by aggressive quantization — so if the squeezed image classifies differently from the attacked image, an attack is likely present.

---

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **Backend**: Flask 3, TensorFlow 2.15 (CPU), Pillow, NumPy
- **Model**: ResNet50V2 pretrained on ImageNet (1000 classes)
