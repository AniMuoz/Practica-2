FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

ENV EN_DOCKER=1
EXPOSE 5000
CMD ["python", "front_flask.py"]
