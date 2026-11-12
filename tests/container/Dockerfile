# Make and the gate image build pass NODE_VERSION from .nvmrc. The tools stage is the delivery
# gate image; the final stage adds the locked dependencies for Make. SoX and ffmpeg come from a
# pinned Debian snapshot at exact versions because the sound builds must reproduce byte-identical
# output.
ARG NODE_VERSION=24.22.2
FROM node:${NODE_VERSION} AS tools
ARG NODE_VERSION

COPY --from=koalaman/shellcheck:v0.11.0 /bin/shellcheck /usr/local/bin/shellcheck

ARG SNAPSHOT=20261103T000000Z

RUN set -eu \
    && rm -f /etc/apt/sources.list.d/debian.sources \
    && printf '%s\n' \
        "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/${SNAPSHOT} bookworm main" \
        "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/${SNAPSHOT} bookworm-updates main" \
        "deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/${SNAPSHOT} bookworm-security main" \
        > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install --yes --no-install-recommends \
        ffmpeg=7:5.1.9-0+deb12u1 \
        sox=14.4.2+git20190427-3.5 \
    && rm -rf /var/lib/apt/lists/* \
    && dpkg-query -W -f '${Version}\n' ffmpeg | grep -qx 7:5.1.9-0+deb12u1 \
    && dpkg-query -W -f '${Version}\n' sox | grep -qx 14.4.2+git20190427-3.5 \
    && sox --version \
    && ffmpeg -version \
    && node --eval "if (process.versions.node !== '${NODE_VERSION}') process.exit(1)"

FROM tools

RUN install -d -m 0755 -o 19001 -g 19001 /opt/check
COPY --chown=19001:19001 package.json package-lock.json /opt/check/
USER 19001:19001
ENV HOME=/tmp
WORKDIR /opt/check
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY --chown=19001:19001 tests/container/check /opt/check/run
WORKDIR /work
