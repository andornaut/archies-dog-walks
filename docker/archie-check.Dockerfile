# Archie art check image: node:24.21.0 with Aseprite 1.2.30 (from the local Aseprite layer), SoX and ffmpeg.
# Build: docker build -t archie-check:node24.21.0-aseprite1.2.30 -f docker/archie-check.Dockerfile docker
FROM game-check:node24.21.0-aseprite1.2.30
RUN set -eu \
    && apt-get -o Acquire::Retries=8 update \
    && apt-get -o Acquire::Retries=8 -o Acquire::Queue-Mode=access install --yes --no-install-recommends ffmpeg sox \
    && rm -rf /var/lib/apt/lists/* \
    && node --eval "if (process.versions.node !== '24.21.0') process.exit(1)" \
    && aseprite -b --version && sox --version && ffmpeg -version | head -1
