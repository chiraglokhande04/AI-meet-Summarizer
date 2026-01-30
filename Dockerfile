# Use Puppeteer base image
FROM ghcr.io/puppeteer/puppeteer:latest

USER root

# Install Xvfb (Fake Screen) and Sound Dependencies
RUN apt-get update && apt-get install -y \
    xvfb \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create start script to run Xvfb + Node
RUN echo '#!/bin/bash\nxvfb-run --server-args="-screen 0 1280x720x24" npm start' > entrypoint.sh
RUN chmod +x entrypoint.sh

# Start command
CMD ["./entrypoint.sh"]