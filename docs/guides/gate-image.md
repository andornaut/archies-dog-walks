# Build the gate image

Build the repository's pinned toolchain when its recipe changes. Run from the repository root after resource admission.

```sh
node_version=$(sed 's/^v//' .nvmrc)
mkdir -p out
tests/container/admit build-image
docker build --resource cpu-period=100000 --resource cpu-quota=400000 --resource memory=4g \
  --build-arg NODE_VERSION="${node_version}" \
  --target toolchain --tag "archie-check:node${node_version}-sox-ffmpeg" \
  --file tests/container/Dockerfile tests/container \
  --iidfile out/gate-image.id
```

Compare `out/gate-image.id` with `gate.image` in `delivery-kit.json`. Verify a changed image before committing a new pin. A new pin is loaded only at a coordinated idle runner restart; building an image does not change the resident runner.

[Gate image reference](../reference/delivery.md) · [Guides](README.md) · [Documentation](../README.md)
