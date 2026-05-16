from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
from tensorflow.keras.applications.resnet_v2 import ResNet50V2, preprocess_input, decode_predictions
import base64
import io
import time

app = Flask(__name__)
CORS(app)

print("Loading ResNet50V2 Model (ImageNet weights)...")
model = ResNet50V2(weights='imagenet')
print("Model loaded successfully.")


def numpy_to_base64(img_array):
    """Convert a [0,1] float numpy array (H,W,3) to a base64 PNG string."""
    img_uint8 = (np.clip(img_array, 0, 1) * 255).astype(np.uint8)
    pil_img = Image.fromarray(img_uint8)
    buffer = io.BytesIO()
    pil_img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def compute_psnr(original, distorted):
    """Compute Peak Signal-to-Noise Ratio between two [0,1] images."""
    mse = np.mean((original - distorted) ** 2)
    if mse == 0:
        return float('inf')
    return float(10 * np.log10(1.0 / mse))


def format_predictions(preds, top=5):
    """Decode predictions and return a list of {label, confidence} dicts."""
    decoded = decode_predictions(preds, top=top)[0]
    return [
        {
            "label": d[1].replace('_', ' ').title(),
            "confidence": round(float(d[2]) * 100, 2)
        }
        for d in decoded
    ]


def generate_fgsm_attack(input_image, target_label_idx, epsilon):
    """Fast Gradient Sign Method (FGSM) adversarial attack."""
    input_tensor = tf.convert_to_tensor(input_image, dtype=tf.float32)
    target_tensor = tf.convert_to_tensor([target_label_idx], dtype=tf.int32)

    with tf.GradientTape() as tape:
        tape.watch(input_tensor)
        preprocessed = preprocess_input(input_tensor * 255.0)
        predictions = model(preprocessed)
        loss = tf.keras.losses.sparse_categorical_crossentropy(target_tensor, predictions)

    gradients = tape.gradient(loss, input_tensor)
    return tf.sign(gradients)


def squeezer_defense(img, bits=5):
    """Feature squeezing via bit-depth reduction."""
    levels = 2 ** bits
    return np.round(img * (levels - 1)) / (levels - 1)


def median_filter_defense(img, kernel_size=2):
    """Simple spatial smoothing defense using local averaging."""
    from PIL import ImageFilter
    img_pil = Image.fromarray((np.clip(img[0], 0, 1) * 255).astype(np.uint8))
    smoothed = img_pil.filter(ImageFilter.MedianFilter(size=kernel_size))
    return np.expand_dims(np.array(smoothed) / 255.0, axis=0)


@app.route('/analyze', methods=['POST'])
def analyze_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files['image']
    epsilon = float(request.form.get('strength', 0.05))
    defense_method = request.form.get('defense', 'squeeze')  # 'squeeze' or 'smooth'

    start_time = time.time()

    img = Image.open(file.stream).resize((224, 224)).convert('RGB')
    img_array = np.array(img) / 255.0
    original_img = np.expand_dims(img_array, axis=0)

    try:
        # ── A. Original Prediction ──────────────────────────────────────────
        prep_orig = preprocess_input(original_img.copy() * 255.0)
        preds_orig = model.predict(prep_orig, verbose=0)
        orig_idx = int(np.argmax(preds_orig[0]))
        orig_top5 = format_predictions(preds_orig)

        # ── B. FGSM Adversarial Attack ──────────────────────────────────────
        perturbations = generate_fgsm_attack(original_img, orig_idx, epsilon)
        adv_img = original_img + (epsilon * perturbations.numpy())
        adv_img = np.clip(adv_img, 0.0, 1.0)

        prep_adv = preprocess_input(adv_img.copy() * 255.0)
        preds_adv = model.predict(prep_adv, verbose=0)
        adv_idx = int(np.argmax(preds_adv[0]))
        adv_top5 = format_predictions(preds_adv)

        # ── C. Defense ─────────────────────────────────────────────────────
        if defense_method == 'smooth':
            recovered_img = median_filter_defense(adv_img)
        else:
            recovered_img = squeezer_defense(adv_img, bits=5)

        prep_rec = preprocess_input(recovered_img.copy() * 255.0)
        preds_rec = model.predict(prep_rec, verbose=0)
        rec_idx = int(np.argmax(preds_rec[0]))
        rec_top5 = format_predictions(preds_rec)

        # ── D. Security Metrics ────────────────────────────────────────────
        l1_dist = float(np.sum(np.abs(preds_adv[0] - preds_rec[0])))
        l2_dist = float(np.linalg.norm(preds_adv[0] - preds_rec[0]))
        attack_psnr = compute_psnr(original_img[0], adv_img[0])
        recovery_psnr = compute_psnr(original_img[0], recovered_img[0])
        pixel_perturbation = float(np.mean(np.abs(adv_img[0] - original_img[0])))
        classification_flipped = orig_idx != adv_idx
        defense_recovered = rec_idx == orig_idx

        # Threat level: 0-100
        threat_score = min(100, int((l1_dist / 2.0) * 100))
        if classification_flipped:
            threat_score = max(threat_score, 60)

        if l1_dist > 0.5:
            status = "CRITICAL: Attack Detected & Neutralized" if defense_recovered else "CRITICAL: Attack Detected — Defense Partial"
        elif l1_dist > 0.2:
            status = "WARNING: Suspicious Input Detected"
        else:
            status = "SAFE: No Adversarial Threat Detected"

        elapsed = round(time.time() - start_time, 3)

        return jsonify({
            "status": status,
            "threat_score": threat_score,
            "classification_flipped": classification_flipped,
            "defense_recovered": defense_recovered,
            "defense_method": "Feature Squeezing (Bit-Depth)" if defense_method == 'squeeze' else "Spatial Smoothing (Median Filter)",

            "original": {
                "top5": orig_top5,
                "image_b64": numpy_to_base64(original_img[0])
            },
            "attacked": {
                "top5": adv_top5,
                "image_b64": numpy_to_base64(adv_img[0])
            },
            "defended": {
                "top5": rec_top5,
                "image_b64": numpy_to_base64(recovered_img[0])
            },

            "metrics": {
                "anomaly_score_l1": round(l1_dist, 4),
                "anomaly_score_l2": round(l2_dist, 4),
                "attack_psnr_db": round(attack_psnr, 2),
                "recovery_psnr_db": round(recovery_psnr, 2),
                "pixel_perturbation": round(pixel_perturbation, 5),
                "epsilon": epsilon,
                "processing_time_s": elapsed,
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "online", "model": "ResNet50V2", "framework": "TensorFlow"})


if __name__ == '__main__':
    app.run(port=5000, debug=True)
