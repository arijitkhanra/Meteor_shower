import os

# Render sets the PORT environment variable (typically 10000)
port = os.environ.get("PORT", "5000")
bind = f"0.0.0.0:{port}"

# Free tier instances have 512 MB RAM.
# Using 1 worker with 4 threads shares in-memory ML models and dataset
# while handling concurrent requests efficiently without hitting memory limits.
workers = 1
threads = 4
timeout = 120
accesslog = "-"
errorlog = "-"

