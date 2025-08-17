FROM --platform=$BUILDPLATFORM node:23 AS builder

# Copy all the files that are not in .dockerignore
COPY . /app
WORKDIR /app

# Build PalaCMS application to pb_public
RUN npm install
RUN npx svelte-kit sync
RUN npx vite --config common.config.js build
RUN npx vite --config app.config.js build

FROM --platform=$BUILDPLATFORM alpine:3 AS downloader

# These arguments can be overridden on build
ARG TARGETOS
ARG TARGETARCH
ARG PB_VERSION=0.29.2
ARG PB_PLATFORM=${TARGETOS}_${TARGETARCH}

# Add dependencies needed from downloading and unzipping
RUN apk add --no-cache \
  unzip \
  ca-certificates

# Download and unzip PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_PLATFORM}.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /app/

FROM alpine:3 AS runtime

ENV PALA_SUPERUSER_EMAIL=
ENV PALA_SUPERUSER_PASSWORD=
ENV PALA_USER_EMAIL=
ENV PALA_USER_PASSWORD=

# Copy downloaded and unzipped PocketBase
COPY --from=downloader /app /app

# Copy built files
COPY --from=builder /app/pb_migrations /app/pb_migrations
COPY --from=builder /app/pb_hooks /app/pb_hooks
COPY --from=builder /app/pb_public /app/pb_public

EXPOSE 8080
WORKDIR /app

CMD ["./pocketbase", "serve", "--http=0.0.0.0:8080"]
