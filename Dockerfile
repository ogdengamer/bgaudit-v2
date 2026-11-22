# Use the official Node.js 22 slim image as our base
FROM node:22-slim

# Create and set the working directory inside the container
WORKDIR /app

# Copy package files first — this lets Docker cache the npm install
# layer so it only re-runs when dependencies actually change
COPY server/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the app
COPY server/ ./
COPY web/ ./web/

# The port our Express server listens on
EXPOSE 4000

# Start the server
CMD ["node", "index.js"]