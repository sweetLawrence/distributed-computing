FROM python:3.11-slim
WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=300
ENV PIP_RETRIES=10
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 300 --retries 10 -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
