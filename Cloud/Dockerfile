FROM rust:1.97-bookworm AS builder
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY migrations ./migrations
RUN cargo build --locked --release -p ksamint-api -p ksamint-vault

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /src/target/release/ksamint-api /usr/local/bin/ksamint-api
COPY --from=builder /src/target/release/ksamint-vault /usr/local/bin/ksamint-vault
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/ksamint-api"]
