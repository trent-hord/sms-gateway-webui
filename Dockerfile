FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Set environment variables
ENV PORT=3000
ENV JOBS_FILE=/app/data/jobs.json

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
