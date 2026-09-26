"""
Multi-Modal Cadastral Dataset Loader & Generator for BhuCadastreTransformer
Parses Punjab geospatial cadastral footprints, land revenue records, and statutory rules.
Provides batches for:
  1. Self-Supervised Pre-Training (Masked Language Modeling + Contrastive Pairs)
  2. Downstream Fine-Tuning (Statutory Anomaly Classification, Property Valuation)
"""

import json
import random
import math
import torch
from torch.utils.data import Dataset, DataLoader

# Core Cadastral Vocabulary for Tokenizer
DEFAULT_VOCAB = [
    '<pad>', '<unk>', '<cls>', '<mask>', '<sep>',
    'bhu', 'aadhaar', 'ulpin', 'sub-ulpin', 'jamabandi', 'khasra', 'khewat', 'khata',
    'punjab', 'amritsar', 'ludhiana', 'jalandhar', 'kot', 'atma', 'singh', 'abadi', 'deh',
    'revenue', 'patwari', 'kanungo', 'tehsildar', 'mutation', 'intiqal', 'warisan', 'girdawari',
    'ladm', 'iso', '19152', 'svamitva', 'lidar', 'slam', 'drone', 'uav', 'survey',
    'subterranean', 'bedrock', 'b30', 'utility', 'tunnel', 'conduit', 'high', 'voltage', 'pspcl',
    'potable', 'water', 'mca', 'ductile', 'iron', 'pipeline', 'png', 'gas', 'natural',
    'telecom', 'optical', 'fiber', 'ofc', 'bsnl', 'bharatnet', 'sewerage', 'drainage', 'culvert',
    'floor', 'ground', 'g00', 'first', 'f01', 'second', 'f02', 'third', 'f03', 'terrace',
    'carpet', 'area', 'sqft', 'sqyd', 'meters', 'plinth', 'height', 'far', 'setback',
    'anomaly', 'violation', 'unauthorized', 'excess', 'notice', 'statutory', 'section', '187',
    'challan', 'penalty', 'demolition', 'fine', 'bharatkosh', 'payment', 'paid', 'pending',
    'residential', 'commercial', 'agricultural', 'industrial', 'encroachment', 'easement'
]


class CadastralTokenizer:
    """
    Lightweight, deterministic word/subword tokenizer tailored for Indian land revenue deeds.
    """
    def __init__(self, vocab=None):
        self.vocab = vocab or DEFAULT_VOCAB
        self.word2id = {w: idx for idx, w in enumerate(self.vocab)}
        self.id2word = {idx: w for idx, w in enumerate(self.vocab)}
        self.pad_id = self.word2id['<pad>']
        self.unk_id = self.word2id['<unk>']
        self.cls_id = self.word2id['<cls>']
        self.mask_id = self.word2id['<mask>']
        self.sep_id = self.word2id['<sep>']

    def encode(self, text, max_len=64, add_special_tokens=True):
        clean_text = text.lower().replace('/', ' ').replace('-', ' ').replace(',', ' ').replace('(', ' ').replace(')', ' ')
        tokens = clean_text.split()
        
        ids = []
        if add_special_tokens:
            ids.append(self.cls_id)

        for t in tokens:
            ids.append(self.word2id.get(t, self.unk_id))

        if add_special_tokens:
            ids.append(self.sep_id)

        if len(ids) > max_len:
            ids = ids[:max_len]
            if add_special_tokens:
                ids[-1] = self.sep_id
        
        attention_mask = [1] * len(ids)
        while len(ids) < max_len:
            ids.append(self.pad_id)
            attention_mask.append(0)

        return ids, attention_mask

    def decode(self, ids):
        tokens = [self.id2word.get(i, '<unk>') for i in ids if i != self.pad_id]
        return " ".join(tokens)


class CadastreDataset(Dataset):
    """
    PyTorch Dataset providing paired geometric coordinates, cadastral metrics, and legal text tokens.
    """
    def __init__(self, samples=None, max_points=16, max_seq_len=64, is_pretrain=True, mask_prob=0.15):
        self.max_points = max_points
        self.max_seq_len = max_seq_len
        self.is_pretrain = is_pretrain
        self.mask_prob = mask_prob
        self.tokenizer = CadastralTokenizer()

        if samples:
            self.samples = samples
        else:
            # Generate rich synthetic + real bootstrap cadastre dataset
            self.samples = self._generate_bootstrap_samples(count=120)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        s = self.samples[idx]

        # 1. Spatial Geometry Coordinates (relative in meters, normalized around centroid)
        coords = s['coordinates']
        num_pts = min(len(coords), self.max_points)
        coords_arr = torch.zeros((self.max_points, 2), dtype=torch.float32)
        point_mask = torch.ones((self.max_points,), dtype=torch.bool) # True = masked/padding

        for i in range(num_pts):
            coords_arr[i, 0] = float(coords[i][0])
            coords_arr[i, 1] = float(coords[i][1])
            point_mask[i] = False

        # 2. Global Cadastral Metrics: [area_sqft, perimeter_m, floors, drone_height_m, centroid_lat, centroid_lng]
        metrics = torch.tensor([
            float(s.get('area_sqft', 2500)) / 5000.0,
            float(s.get('perimeter_m', 60)) / 150.0,
            float(s.get('floors', 3)) / 6.0,
            float(s.get('drone_height_m', 10.5)) / 25.0,
            (float(s.get('centroid_lat', 31.6125)) - 31.0),
            (float(s.get('centroid_lng', 74.8620)) - 74.0)
        ], dtype=torch.float32)

        # 3. Legal Deed Text & Masking for Pretraining
        input_ids, attention_mask = self.tokenizer.encode(s['text'], max_len=self.max_seq_len)
        input_ids = torch.tensor(input_ids, dtype=torch.long)
        attention_mask = torch.tensor(attention_mask, dtype=torch.long)

        target_ids = torch.full_like(input_ids, -100)
        masked_input_ids = input_ids.clone()

        if self.is_pretrain:
            for i in range(1, len(input_ids) - 1):
                if attention_mask[i] == 1 and random.random() < self.mask_prob:
                    target_ids[i] = input_ids[i]
                    rand = random.random()
                    if rand < 0.8:
                        masked_input_ids[i] = self.tokenizer.mask_id
                    elif rand < 0.9:
                        masked_input_ids[i] = random.randint(5, len(self.tokenizer.vocab) - 1)

        return {
            'coords': coords_arr,
            'metrics': metrics,
            'point_mask': point_mask,
            'input_ids': input_ids,
            'masked_input_ids': masked_input_ids,
            'target_ids': target_ids,
            'text_mask': attention_mask,
            'anomaly_label': torch.tensor(s.get('anomaly_class', 0), dtype=torch.long),
            'valuation_target': torch.tensor(s.get('valuation_lakhs', 45.0), dtype=torch.float32),
            'dispute_risk_label': torch.tensor(s.get('dispute_risk', 0.0), dtype=torch.float32)
        }

    def _generate_bootstrap_samples(self, count=120):
        samples = []
        parcels_seed = [
            {
                'survey': 'Khasra No. 412/1',
                'ulpin': 'PB02-8599-6103',
                'owner': 'Sardar Harpreet Singh',
                'anomaly_class': 1, # Vertical extension excess
                'text': 'Bhu Aadhaar ULPIN PB02 8599 6103 Jamabandi Khasra 412 1 Kot Atma Singh Amritsar. Declared Ground plus 1 villa. Autonomous Drone LiDAR SLAM detected unauthorized Level 3 extension plus 3.2m height excess. Statutory Section 187 notice issued.',
                'floors': 3,
                'drone_height_m': 10.5,
                'area_sqft': 3105,
                'valuation_lakhs': 85.0,
                'dispute_risk': 1.0
            },
            {
                'survey': 'Khasra No. 308/2',
                'ulpin': 'PB02-8612-4019',
                'owner': 'Gurcharan Singh',
                'anomaly_class': 2, # Subterranean easement breach
                'text': 'Bhu Aadhaar ULPIN PB02 8612 4019 Jamabandi Khasra 308 2. Ground penetrating radar detected subterranean basement encroachment into municipal gas conduit right of way. Section 187 statutory municipal notice.',
                'floors': 2,
                'drone_height_m': 6.8,
                'area_sqft': 2200,
                'valuation_lakhs': 52.0,
                'dispute_risk': 1.0
            },
            {
                'survey': 'Khasra No. 429/1',
                'ulpin': 'PB02-8605-1025',
                'owner': 'Sardar Harpreet Singh',
                'anomaly_class': 0, # Fully compliant
                'text': 'Bhu Aadhaar ULPIN PB02 8605 1025 Jamabandi Record of Rights Kot Atma Singh Amritsar. ISO 19152 LADM 3D verified digitalized twin. Fully compliant construction within municipal bye laws and Floor Area Ratio.',
                'floors': 2,
                'drone_height_m': 6.6,
                'area_sqft': 2800,
                'valuation_lakhs': 72.0,
                'dispute_risk': 0.0
            }
        ]

        for i in range(count):
            base = parcels_seed[i % len(parcels_seed)]
            # Generate random realistic geometric polygon in meters centered at (0, 0)
            w = random.uniform(12, 28)
            l = random.uniform(14, 32)
            coords = [
                [-w/2, -l/2],
                [w/2, -l/2],
                [w/2 + random.uniform(-1, 1), l/2],
                [-w/2, l/2],
                [-w/2, -l/2]
            ]
            sample = dict(base)
            sample['coordinates'] = coords
            sample['area_sqft'] = w * l * 10.7639
            sample['perimeter_m'] = 2 * (w + l)
            sample['centroid_lat'] = 31.6125 + random.uniform(-0.01, 0.01)
            sample['centroid_lng'] = 74.8620 + random.uniform(-0.01, 0.01)
            samples.append(sample)

        return samples


def get_cadastre_dataloaders(batch_size=16, test_split=0.2, is_pretrain=True):
    dataset = CadastreDataset(is_pretrain=is_pretrain)
    val_size = int(len(dataset) * test_split)
    train_size = len(dataset) - val_size
    train_ds, val_ds = torch.utils.data.random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    return train_loader, val_loader
