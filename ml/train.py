"""
Downstream Multi-Task Training Pipeline for BhuCadastreTransformer
Fine-tunes pre-trained representations on:
  1. Statutory Anomaly & Violation Detection (Level 3 excess, utility encroachment)
  2. Land & Superstructure Valuation (Property Tax Assessment in Lakhs INR)
"""

import os
import sys
import argparse
import time
import torch
import torch.nn.functional as F
from torch.optim import AdamW

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from model import BhuCadastreTransformer
from dataset import get_cadastre_dataloaders


def train_downstream(pretrained_checkpoint=None, epochs=4, batch_size=16, lr=1e-4, save_dir='ml/checkpoints'):
    os.makedirs(save_dir, exist_ok=True)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"🎯 Initializing BhuCadastreTransformer Downstream Fine-Tuning on [{device}]...")

    # Load Model
    model = BhuCadastreTransformer(vocab_size=8000, d_model=256, max_points=16, max_seq_len=64)
    if pretrained_checkpoint and os.path.exists(pretrained_checkpoint):
        print(f"📂 Loading pre-trained weights from: {pretrained_checkpoint}")
        ckpt = torch.load(pretrained_checkpoint, map_location=device)
        model.load_state_dict(ckpt['model_state_dict'], strict=False)
        print("✨ Pre-trained weights successfully transferred!")
    else:
        print("ℹ️ No pre-trained checkpoint specified; training from initial weights.")

    model.to(device)

    # Dataloaders
    train_loader, val_loader = get_cadastre_dataloaders(batch_size=batch_size, is_pretrain=False)

    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=0.01)

    print("-" * 80)
    print(f"{'Epoch':<8}{'Train Loss':<14}{'Val Loss':<14}{'Anomaly Acc':<16}{'Val MAE (₹L)':<16}{'Time':<8}")
    print("-" * 80)

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        start_time = time.time()

        for batch in train_loader:
            coords = batch['coords'].to(device)
            metrics = batch['metrics'].to(device)
            input_ids = batch['input_ids'].to(device)
            point_mask = batch['point_mask'].to(device)
            text_mask = batch['text_mask'].to(device)
            anomaly_labels = batch['anomaly_label'].to(device)
            val_targets = batch['valuation_target'].to(device)

            optimizer.zero_grad()
            preds = model.predict_downstream(coords, metrics, input_ids, point_mask=point_mask, text_mask=text_mask)

            # Task 1: Anomaly Classification Loss
            loss_cls = F.cross_entropy(preds['anomaly_logits'], anomaly_labels)

            # Task 2: Valuation Regression Loss (Smooth L1)
            loss_val = F.smooth_l1_loss(preds['predicted_valuation'], val_targets)

            loss = loss_cls + 0.05 * loss_val
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            train_loss += loss.item()

        # Validation Loop
        model.eval()
        val_loss = 0.0
        correct_cls = 0
        total_samples = 0
        total_mae = 0.0

        with torch.no_grad():
            for batch in val_loader:
                coords = batch['coords'].to(device)
                metrics = batch['metrics'].to(device)
                input_ids = batch['input_ids'].to(device)
                point_mask = batch['point_mask'].to(device)
                text_mask = batch['text_mask'].to(device)
                anomaly_labels = batch['anomaly_label'].to(device)
                val_targets = batch['valuation_target'].to(device)

                preds = model.predict_downstream(coords, metrics, input_ids, point_mask=point_mask, text_mask=text_mask)
                loss_cls = F.cross_entropy(preds['anomaly_logits'], anomaly_labels)
                loss_val = F.smooth_l1_loss(preds['predicted_valuation'], val_targets)
                val_loss += (loss_cls + 0.05 * loss_val).item()

                predicted_classes = preds['predicted_anomaly_class']
                correct_cls += (predicted_classes == anomaly_labels).sum().item()
                total_mae += torch.abs(preds['predicted_valuation'] - val_targets).sum().item()
                total_samples += coords.size(0)

        elapsed = time.time() - start_time
        num_train = max(1, len(train_loader))
        num_val = max(1, len(val_loader))
        avg_train_loss = train_loss / num_train
        avg_val_loss = val_loss / num_val
        val_acc = (correct_cls / max(1, total_samples)) * 100.0
        val_mae = total_mae / max(1, total_samples)

        print(f"{epoch:<8}{avg_train_loss:<14.4f}{avg_val_loss:<14.4f}{val_acc:<15.1f}%{val_mae:<16.2f}{elapsed:<8.2f}s")

    # Save fine-tuned model checkpoint
    final_path = os.path.join(save_dir, 'bhu_cadastre_finetuned.pt')
    torch.save({
        'model_state_dict': model.state_dict(),
        'val_accuracy': val_acc,
        'val_mae': val_mae,
        'epochs': epochs
    }, final_path)

    print("-" * 80)
    print(f"🎉 Fine-Tuning Complete! Model exported to: {final_path}")
    return final_path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fine-tune BhuCadastreTransformer')
    parser.add_argument('--pretrained_checkpoint', type=str, default='ml/checkpoints/pretrained_cadastre.pt')
    parser.add_argument('--epochs', type=int, default=3)
    parser.add_argument('--batch_size', type=int, default=16)
    parser.add_argument('--lr', type=float, default=1e-4)
    parser.add_argument('--save_dir', type=str, default='ml/checkpoints')
    args = parser.parse_args()

    train_downstream(
        pretrained_checkpoint=args.pretrained_checkpoint,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        save_dir=args.save_dir
    )
