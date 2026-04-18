# Stage 1: Build the React application
FROM node:18-alpine AS build
WORKDIR /app

# Copy lockfiles first for better cache utilization
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source and build
COPY . .
RUN yarn build

# Stage 2: Serve with Nginx (minimal runtime image)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
