FROM python:3.12-slim

WORKDIR /app

# System deps for netCDF4 + xarray
RUN apt-get update && apt-get install -y --no-install-recommends \
      libhdf5-dev libnetcdf-dev gcc build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY fetch.py .

CMD ["python", "fetch.py", "--days", "3"]
