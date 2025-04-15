FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json files
COPY package*.json ./

# Copy workspace package.json files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY admin-portal/package*.json ./admin-portal/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build frontend and admin portal
RUN npm run build --workspace=frontend
RUN npm run build --workspace=admin-portal

# Expose backend port
EXPOSE 5000

# Start backend server
CMD ["npm", "run", "start", "--workspace=backend"] 