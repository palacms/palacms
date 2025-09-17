FROM --platform=$BUILDPLATFORM node:24-alpine AS node-builder

# Copy all the files that are not in .dockerignore
COPY . /app
WORKDIR /app

# Build frontend
RUN npm install
RUN npx svelte-kit sync
RUN npx vite --config common.config.js build
RUN npx vite --config app.config.js build

FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS go-builder

# These arguments can be overridden on build
ARG TARGETOS
ARG TARGETARCH

# Copy all the files that are not in .dockerignore
COPY . /app
WORKDIR /app

# Copy built frontend
COPY --from=node-builder /app/internal/build /app/internal/build
COPY --from=node-builder /app/internal/common /app/internal/common

# Build executable
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o palacms

FROM alpine:3 AS runtime

ARG PALA_VERSION

ENV PALA_VERSION=${PALA_VERSION}
ENV PALA_SUPERUSER_EMAIL=
ENV PALA_SUPERUSER_PASSWORD=
ENV PALA_USER_EMAIL=
ENV PALA_USER_PASSWORD=

# Copy build executable
COPY --from=go-builder /app/palacms /app/palacms

EXPOSE 8080
WORKDIR /app

CMD ["./palacms", "serve", "--http=0.0.0.0:8080"]
