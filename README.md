# 3D ULPIN Generation & Vertical Property Mapping System

Purpose
- Provide a scalable system to generate Unique Land Parcel Identification Numbers (3D ULPIN) and support vertical/volumetric cadastral mapping
- Integrate drone imagery, LiDAR/3D point clouds, GIS parcel layers, building floorplans, GNSS/CORS coordinates, DEM/DSM
- Provide AI/ML tooling for automated building extraction, floor segmentation, vertical parcel delineation, and topology validation

Architecture (high level)
- Ingestion: PDAL, drone imagery pipelines, GNSS/CORS recorder
- Data Storage: PostGIS (PostgreSQL), object storage (MinIO)
- Processing: Python pipelines for pointcloud & imagery (NumPy, PDAL, rasterio)
- ML: PyTorch/TensorFlow models for building extraction & floor segmentation
- API: FastAPI backend exposing ULPIN generation & retrieval endpoints
- Frontend: React/TypeScript map UI using OpenLayers/MapLibre or Mapbox GL
- Orchestration: Docker Compose for local dev, Kubernetes/Terraform for production

Getting started (local)
1. Install Docker & Docker Compose
2. Copy `.env.example` to `.env` and adjust credentials
3. `docker-compose up --build`
4. Backend: http://localhost:8000/docs (OpenAPI)
5. Frontend: http://localhost:3000

See docs/ for design decisions, ULPIN spec and data model.
