FROM rust:1.97.1-trixie@sha256:3382bd20aa942806c533e9a73cd000474fb3ef173f71e684cc9b942675781769 AS builder
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY migrations ./migrations
RUN cargo build --locked --release -p ksamint-api -p ksamint-vault

FROM debian:trixie-slim@sha256:3a39a0592364683e6bab97937b72cad5a8fa6dcbbee90edb3bb48c7f8e94f258
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /src/target/release/ksamint-api /usr/local/bin/ksamint-api
COPY --from=builder /src/target/release/ksamint-vault /usr/local/bin/ksamint-vault
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 \
    CMD ["/usr/local/bin/ksamint-api", "--healthcheck"]
ENTRYPOINT ["/usr/local/bin/ksamint-api"]
