"""
BhuCadastreTransformer: Multi-Modal Spatial-Cadastral & Legal Transformer
Architecture designed for Indian Land Modernization (Bhu-Aadhaar / DILRMP / SVAMITVA 2.0).

Encodes:
  1. 2D/3D Polygon Footprint Geometry (Vertices, Area, Perimeter, Height, Centroid)
  2. Legal & Cadastral Records (Punjab Land Revenue Act, Jamabandi, Khasra, Sub-ULPINs)
Fuses via Multi-Head Cross-Attention.
Supports:
  - Self-Supervised Pre-Training (Masked Language Modeling + Contrastive Spatial-Legal Alignment)
  - Downstream Fine-Tuning (Statutory Anomaly Classification, Property Valuation, Mutation Risk)
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


class FourierSpatialPositionalEncoding(nn.Module):
    """
    High-frequency Fourier positional embeddings for 2D/3D geographic coordinates.
    gamma(p) = [sin(2^0 pi p), cos(2^0 pi p), ..., sin(2^(L-1) pi p), cos(2^(L-1) pi p)]
    """
    def __init__(self, num_frequencies=8, input_dim=2):
        super().__init__()
        self.num_frequencies = num_frequencies
        self.input_dim = input_dim
        freq_bands = 2.0 ** torch.linspace(0, num_frequencies - 1, num_frequencies)
        self.register_buffer('freq_bands', freq_bands)

    def forward(self, x):
        # x: [batch_size, num_points, input_dim]
        # output: [batch_size, num_points, input_dim * num_frequencies * 2]
        batch_size, num_points, dim = x.shape
        x_expanded = x.unsqueeze(-1) * self.freq_bands * math.pi
        sin_emb = torch.sin(x_expanded)
        cos_emb = torch.cos(x_expanded)
        fourier_features = torch.cat([sin_emb, cos_emb], dim=-1)
        return fourier_features.view(batch_size, num_points, -1)


class SpatialGeometryEncoder(nn.Module):
    """
    Encodes polygon boundary coordinates and 3D cadastral metrics
    (area, perimeter, declared floors, drone height) into dense spatial tokens.
    """
    def __init__(self, d_model=256, max_points=32, num_frequencies=8):
        super().__init__()
        self.d_model = d_model
        self.max_points = max_points
        self.fourier_dim = 2 * num_frequencies * 2

        self.fourier_enc = FourierSpatialPositionalEncoding(num_frequencies=num_frequencies, input_dim=2)
        
        # Point feature projector: Fourier features + raw relative coordinates (2)
        self.point_proj = nn.Sequential(
            nn.Linear(self.fourier_dim + 2, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Linear(d_model, d_model)
        )

        # Global Cadastral Metrics: [area_sqft, perimeter_m, floors, drone_height_m, centroid_lat, centroid_lng] (6 dims)
        self.metrics_proj = nn.Sequential(
            nn.Linear(6, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Linear(d_model, d_model)
        )

        # Spatial Self-Attention across polygon vertices
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=4,
            dim_feedforward=d_model * 4,
            dropout=0.1,
            activation='gelu',
            batch_first=True,
            norm_first=True
        )
        self.spatial_transformer = nn.TransformerEncoder(encoder_layer, num_layers=2)

    def forward(self, coords, metrics, point_mask=None):
        """
        coords: [batch_size, max_points, 2] (relative coordinates in meters)
        metrics: [batch_size, 6]
        point_mask: [batch_size, max_points] (True for padding)
        """
        batch_size, num_points, _ = coords.shape
        fourier = self.fourier_enc(coords)
        point_feat = torch.cat([coords, fourier], dim=-1)
        point_tokens = self.point_proj(point_feat) # [B, N, d_model]

        # Global metrics token
        global_token = self.metrics_proj(metrics).unsqueeze(1) # [B, 1, d_model]

        # Concatenate global metric token at index 0 (like a [CLS] token)
        spatial_tokens = torch.cat([global_token, point_tokens], dim=1) # [B, 1 + N, d_model]

        if point_mask is not None:
            cls_mask = torch.zeros((batch_size, 1), dtype=torch.bool, device=coords.device)
            full_mask = torch.cat([cls_mask, point_mask], dim=1)
        else:
            full_mask = None

        encoded_spatial = self.spatial_transformer(spatial_tokens, src_key_padding_mask=full_mask)
        return encoded_spatial # [B, 1 + N, d_model]


class LegalTextEncoder(nn.Module):
    """
    Encodes land revenue deeds, Jamabandi records, municipal acts, and statutory rules.
    """
    def __init__(self, vocab_size=8000, d_model=256, max_len=128, num_layers=4, nhead=4):
        super().__init__()
        self.token_embeddings = nn.Embedding(vocab_size, d_model, padding_idx=0)
        self.pos_embeddings = nn.Embedding(max_len, d_model)
        self.norm = nn.LayerNorm(d_model)
        self.dropout = nn.Dropout(0.1)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=d_model * 4,
            dropout=0.1,
            activation='gelu',
            batch_first=True,
            norm_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

    def forward(self, input_ids, attention_mask=None):
        """
        input_ids: [batch_size, seq_len]
        attention_mask: [batch_size, seq_len] (1 for valid, 0 for pad)
        """
        seq_len = input_ids.size(1)
        positions = torch.arange(0, seq_len, dtype=torch.long, device=input_ids.device).unsqueeze(0)
        
        x = self.token_embeddings(input_ids) + self.pos_embeddings(positions)
        x = self.dropout(self.norm(x))

        key_padding_mask = (attention_mask == 0) if attention_mask is not None else None
        encoded_text = self.transformer(x, src_key_padding_mask=key_padding_mask)
        return encoded_text # [B, seq_len, d_model]


class CrossModalCadastreFusion(nn.Module):
    """
    Bi-directional cross-attention between spatial footprint geometry and legal deed text.
    """
    def __init__(self, d_model=256, nhead=4):
        super().__init__()
        self.spatial_to_text_attn = nn.MultiheadAttention(d_model, nhead, dropout=0.1, batch_first=True)
        self.text_to_spatial_attn = nn.MultiheadAttention(d_model, nhead, dropout=0.1, batch_first=True)

        self.norm_spatial = nn.LayerNorm(d_model)
        self.norm_text = nn.LayerNorm(d_model)

        self.ffn = nn.Sequential(
            nn.Linear(d_model * 2, d_model * 2),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(d_model * 2, d_model)
        )
        self.final_norm = nn.LayerNorm(d_model)

    def forward(self, spatial_tokens, text_tokens, spatial_mask=None, text_mask=None):
        # spatial cross attends to text
        s2t, _ = self.spatial_to_text_attn(
            query=spatial_tokens,
            key=text_tokens,
            value=text_tokens,
            key_padding_mask=(text_mask == 0) if text_mask is not None else None
        )
        spatial_fused = self.norm_spatial(spatial_tokens + s2t)

        # text cross attends to spatial
        t2s, _ = self.text_to_spatial_attn(
            query=text_tokens,
            key=spatial_tokens,
            value=spatial_tokens,
            key_padding_mask=spatial_mask
        )
        text_fused = self.norm_text(text_tokens + t2s)

        # Global representations (CLS tokens)
        global_spatial = spatial_fused[:, 0, :] # [B, d_model]
        global_text = text_fused[:, 0, :]       # [B, d_model]

        combined = torch.cat([global_spatial, global_text], dim=-1)
        fused_vector = self.final_norm(self.ffn(combined) + global_spatial)
        return fused_vector, spatial_fused, text_fused


class BhuCadastreTransformer(nn.Module):
    """
    Complete Multi-Modal Model for Bhu-Aadhaar 3D Cadastral Intelligence.
    Capable of self-supervised pre-training and downstream fine-tuning.
    """
    def __init__(self, vocab_size=8000, d_model=256, max_points=32, max_seq_len=128):
        super().__init__()
        self.d_model = d_model
        self.vocab_size = vocab_size

        # Encoders
        self.spatial_encoder = SpatialGeometryEncoder(d_model=d_model, max_points=max_points)
        self.legal_encoder = LegalTextEncoder(vocab_size=vocab_size, d_model=d_model, max_len=max_seq_len)
        self.cross_fusion = CrossModalCadastreFusion(d_model=d_model)

        # ---------------------------------------------------------------------
        # Pre-Training Heads
        # ---------------------------------------------------------------------
        # 1. Masked Language/Token Modeling Head
        self.mlm_head = nn.Sequential(
            nn.Linear(d_model, d_model),
            nn.GELU(),
            nn.LayerNorm(d_model),
            nn.Linear(d_model, vocab_size)
        )
        # 2. Contrastive Spatial-Legal Alignment Projection
        self.spatial_contrast_proj = nn.Linear(d_model, 128)
        self.legal_contrast_proj = nn.Linear(d_model, 128)
        self.temperature = nn.Parameter(torch.tensor(0.07))

        # ---------------------------------------------------------------------
        # Downstream Fine-Tuning Heads
        # ---------------------------------------------------------------------
        # 1. Anomaly Classification (0: Compliant, 1: Vertical Height Excess, 2: Utility Easement Breach)
        self.anomaly_classifier = nn.Sequential(
            nn.Linear(d_model, 128),
            nn.GELU(),
            nn.Dropout(0.2),
            nn.Linear(128, 3)
        )
        # 2. Land & Superstructure Valuation Head (INR tax / value regression)
        self.valuation_head = nn.Sequential(
            nn.Linear(d_model, 128),
            nn.GELU(),
            nn.Linear(128, 1)
        )
        # 3. Mutation Legal Dispute Risk (Binary: 0=Safe, 1=Contested)
        self.dispute_risk_head = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.GELU(),
            nn.Linear(64, 1)
        )

    def forward(self, coords, metrics, input_ids, point_mask=None, text_mask=None):
        # 1. Encode spatial footprint
        spatial_tokens = self.spatial_encoder(coords, metrics, point_mask=point_mask)

        # 2. Encode legal deed text
        text_tokens = self.legal_encoder(input_ids, attention_mask=text_mask)

        # 3. Cross-modal fusion
        if point_mask is not None:
            cls_mask = torch.zeros((coords.size(0), 1), dtype=torch.bool, device=coords.device)
            full_spatial_mask = torch.cat([cls_mask, point_mask], dim=1)
        else:
            full_spatial_mask = None

        fused_rep, spatial_fused, text_fused = self.cross_fusion(
            spatial_tokens, text_tokens,
            spatial_mask=full_spatial_mask, text_mask=text_mask
        )

        return {
            'fused': fused_rep,
            'spatial_tokens': spatial_fused,
            'text_tokens': text_fused
        }

    # -------------------------------------------------------------------------
    # Pre-training loss methods
    # -------------------------------------------------------------------------
    def compute_pretrain_loss(self, coords, metrics, masked_input_ids, target_ids, point_mask=None, text_mask=None):
        out = self.forward(coords, metrics, masked_input_ids, point_mask=point_mask, text_mask=text_mask)
        text_tokens = out['text_tokens']

        # 1. Masked Token Prediction Loss
        logits = self.mlm_head(text_tokens) # [B, seq_len, vocab_size]
        mlm_loss = F.cross_entropy(
            logits.view(-1, self.vocab_size),
            target_ids.view(-1),
            ignore_index=-100
        )

        # 2. Contrastive Spatial-Legal Alignment Loss (InfoNCE)
        spatial_cls = out['spatial_tokens'][:, 0, :]
        text_cls = out['text_tokens'][:, 0, :]

        z_s = F.normalize(self.spatial_contrast_proj(spatial_cls), dim=-1)
        z_t = F.normalize(self.legal_contrast_proj(text_cls), dim=-1)

        sim_matrix = torch.matmul(z_s, z_t.T) / torch.clamp(self.temperature, min=0.01, max=0.5)
        labels = torch.arange(coords.size(0), device=coords.device)
        contrast_loss = (F.cross_entropy(sim_matrix, labels) + F.cross_entropy(sim_matrix.T, labels)) / 2.0

        total_loss = mlm_loss + 0.5 * contrast_loss
        return {
            'loss': total_loss,
            'mlm_loss': mlm_loss.item(),
            'contrast_loss': contrast_loss.item()
        }

    # -------------------------------------------------------------------------
    # Downstream fine-tuning predictions
    # -------------------------------------------------------------------------
    def predict_downstream(self, coords, metrics, input_ids, point_mask=None, text_mask=None):
        out = self.forward(coords, metrics, input_ids, point_mask=point_mask, text_mask=text_mask)
        fused = out['fused']

        anomaly_logits = self.anomaly_classifier(fused)
        valuation = self.valuation_head(fused).squeeze(-1)
        dispute_logits = self.dispute_risk_head(fused).squeeze(-1)

        return {
            'anomaly_logits': anomaly_logits,
            'anomaly_probs': F.softmax(anomaly_logits, dim=-1),
            'predicted_anomaly_class': torch.argmax(anomaly_logits, dim=-1),
            'predicted_valuation': valuation,
            'dispute_risk_prob': torch.sigmoid(dispute_logits)
        }
