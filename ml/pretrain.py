"""
Pre-Training Pipeline for BhuCadastreTransformer
Executes self-supervised pre-training using:
  1. Masked Language Modeling (MLM) on statutory revenue deeds & cadastral records
  2. Contrastive InfoNCE Alignment between 2D/3D polygon footprints and legal texts
"""

import os
import sys
import argparse
import time
import torch
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from model import BhuCadastreTransformer
from dataset import get_cadastre_dataloaders


def pretrain(epochs=5, batch_size=16, lr=3e-4, save_dir='ml/checkpoints'):
    os.makedirs(save_dir, exist_ok=True)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"🚀 Initializing BhuCadastreTransformer Pre-Training Pipeline on [{device}]...")

    # Dataloaders
    train_loader, val_loader = get_cadastre_dataloaders(batch_size=batch_size, is_pretrain=True)
    print(f"📦 Loaded {len(train_loader.dataset)} training samples across {len(train_loader)} batches.")

    # Model
    model = BhuCadastreTransformer(vocab_size=8000, d_model=256, max_points=16, max_seq_len=64)
    model.to(device)

    # Optimizer & Scheduler
    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    print("-" * 75)
    print(f"{'Epoch':<8}{'Train Loss':<14}{'MLM Loss':<14}{'Contrastive':<14}{'LR':<12}{'Time':<8}")
    print("-" * 75)

    best_loss = float('inf')
    history = []

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        total_mlm = 0.0
        total_contrast = 0.0
        start_time = time.time()

        for batch in train_loader:
            coords = batch['coords'].to(device)
            metrics = batch['metrics'].to(device)
            masked_ids = batch['masked_input_ids'].to(device)
            target_ids = batch['target_ids'].to(device)
            point_mask = batch['point_mask'].to(device)
            text_mask = batch['text_mask'].to(device)

            optimizer.zero_grad()
            loss_dict = model.compute_pretrain_loss(
                coords=coords,
                metrics=metrics,
                masked_input_ids=masked_ids,
                target_ids=target_ids,
                point_mask=point_mask,
                text_mask=text_mask
            )

            loss = loss_dict['loss']
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            total_loss += loss.item()
            total_mlm += loss_dict['mlm_loss']
            total_contrast += loss_dict['contrast_loss']

        scheduler.step()
        elapsed = time.time() - start_time
        num_batches = max(1, len(train_loader))
        avg_loss = total_loss / num_batches
        avg_mlm = total_mlm / num_batches
        avg_contrast = total_contrast / num_batches
        current_lr = scheduler.get_last_lr()[0]

        print(f"{epoch:<8}{avg_loss:<14.4f}{avg_mlm:<14.4f}{avg_contrast:<14.4f}{current_lr:<12.6f}{elapsed:<8.2f}s")
        history.append({'epoch': epoch, 'loss': avg_loss, 'mlm': avg_mlm, 'contrast': avg_contrast})

        # Save checkpoint
        checkpoint_path = os.path.join(save_dir, 'pretrained_cadastre.pt')
        torch.save({
            'epoch': epoch,
            'model_state_dict': model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'loss': avg_loss,
            'history': history
        }, checkpoint_path)

    print("-" * 75)
    print(f"✅ Self-Supervised Pre-Training Complete! Saved checkpoint to: {checkpoint_path}")
    return checkpoint_path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Pre-train BhuCadastreTransformer')
    parser.add_argument('--epochs', type=int, default=3, help='Number of pre-training epochs')
    parser.add_argument('--batch_size', type=int, default=16, help='Batch size')
    parser.add_argument('--lr', type=float, default=3e-4, help='Learning rate')
    parser.add_argument('--save_dir', type=str, default='ml/checkpoints', help='Directory to save checkpoints')
    args = parser.parse_args()

    pretrain(epochs=args.epochs, batch_size=args.batch_size, lr=args.lr, save_dir=args.save_dir)
