from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
from tensorflow.keras.applications.resnet_v2 import ResNet50V2, preprocess_input, decode_predictions

app = Flask(__name__)
CORS(app) 

print("Loading High-Res AI Model...")
model = ResNet50V2(weights='imagenet')

def generate_attack(input_image, target_label_idx):
    input_tensor = tf.convert_to_tensor(input_image, dtype=tf.float32)
    target_tensor = tf.convert_to_tensor([target_label_idx], dtype=tf.int32)
    
    with tf.GradientTape() as tape:
        tape.watch(input_tensor)
        preprocessed = preprocess_input(input_tensor * 255.0)
        predictions = model(preprocessed)
        loss = tf.keras.losses.sparse_categorical_crossentropy(target_tensor, predictions)
    
    gradients = tape.gradient(loss, input_tensor)
    return tf.sign(gradients)

def squeezer_defense(img, bits=3):
    levels = 2 ** bits
    return np.round(img * (levels - 1)) / (levels - 1)

@app.route('/analyze', methods=['POST'])
def analyze_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files['image']
    # Grab the attack strength from the frontend slider (default to 0.05 if missing)
    attack_strength = float(request.form.get('strength', 0.05))
    
    img = Image.open(file.stream).resize((224, 224)).convert('RGB')
    img_array = np.array(img) / 255.0
    original_img = np.expand_dims(img_array, axis=0)

    try:
        # --- A. Original Prediction ---
        prep_orig = preprocess_input(original_img.copy() * 255.0)
        preds_orig = model.predict(prep_orig)
        orig_idx = int(np.argmax(preds_orig[0]))
        orig_label = decode_predictions(preds_orig, top=1)[0][0][1]

        # --- B. The Hacker Attack (Using the dynamic slider value!) ---
        perturbations = generate_attack(original_img, orig_idx)
        adv_img = original_img + (attack_strength * perturbations)
        adv_img = tf.clip_by_value(adv_img, 0.0, 1.0).numpy()
        
        prep_adv = preprocess_input(adv_img.copy() * 255.0)
        preds_adv = model.predict(prep_adv)
        adv_label = decode_predictions(preds_adv, top=1)[0][0][1]

        # --- C. Your Squeezer Defense ---
        recovered_img = squeezer_defense(adv_img, bits=3)
        prep_rec = preprocess_input(recovered_img.copy() * 255.0)
        preds_rec = model.predict(prep_rec)
        rec_label = decode_predictions(preds_rec, top=1)[0][0][1]

        # --- D. Security Logic ---
        dist = np.sum(np.abs(preds_adv[0] - preds_rec[0]))
        status = "ALARM: Attack Detected!" if dist > 0.5 else "SAFE"

        return jsonify({
            "status": status,
            "original_prediction": str(orig_label).replace('_', ' ').title(),
            "attacked_prediction": str(adv_label).replace('_', ' ').title(),
            "defended_prediction": str(rec_label).replace('_', ' ').title(),
            "anomaly_score": float(dist)
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)