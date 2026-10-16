FROM python:3.12-slim
WORKDIR /srv/intelligence-service
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# data dir is mounted at /data; config resolves it relative to the repo layout
RUN mkdir -p /srv/data/raw /srv/data/processed
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
