#!/usr/bin/env ruby
# frozen_string_literal: true

require 'base64'
require 'json'
require 'net/http'
require 'openssl'
require 'uri'

def base64url(data)
  Base64.urlsafe_encode64(data, padding: false)
end

def jwt(private_key_path, key_id, issuer_id)
  header = base64url(JSON.generate(alg: 'ES256', kid: key_id, typ: 'JWT'))
  now = Time.now.to_i
  claims = base64url(JSON.generate(iss: issuer_id, iat: now - 5, exp: now + 1_200, aud: 'appstoreconnect-v1'))
  input = "#{header}.#{claims}"
  key = OpenSSL::PKey.read(File.binread(private_key_path))
  sequence = OpenSSL::ASN1.decode(key.dsa_sign_asn1(OpenSSL::Digest::SHA256.digest(input)))
  signature = sequence.value.map { |integer| integer.value.to_s(2).rjust(32, "\0") }.join
  "#{input}.#{base64url(signature)}"
end

def credentials
  directory = ENV['ASC_CREDENTIAL_DIRECTORY']
  abort 'Set ASC_CREDENTIAL_DIRECTORY to the private App Store Connect key directory' if directory.nil? || directory.empty?
  key_path = Dir[File.join(directory, 'AuthKey_*.p8')].first or abort 'Missing App Store Connect key'
  key_id = File.basename(key_path)[/AuthKey_([A-Z0-9]+)\.p8/, 1] or abort 'Invalid key filename'
  metadata = Dir[File.join(directory, '*issuer*')].first or abort 'Missing issuer metadata'
  issuer_id = File.read(metadata)[/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i]
  abort 'Missing issuer ID' unless issuer_id
  [key_path, key_id, issuer_id]
end

method = ARGV.fetch(0, 'GET').upcase
path = ARGV.fetch(1, '/v1/apps')
body_path = ARGV[2]
abort 'App Store Connect paths must begin with /v1/' unless path.start_with?('/v1/')

key_path, key_id, issuer_id = credentials
uri = URI("https://api.appstoreconnect.apple.com#{path}")
request_class = Net::HTTP.const_get(method.capitalize)
request = request_class.new(uri)
request['Authorization'] = "Bearer #{jwt(key_path, key_id, issuer_id)}"
request['Content-Type'] = 'application/json'
request.body = body_path == '-' ? $stdin.read : File.binread(body_path) if body_path

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
  http.request(request)
end

warn "HTTP #{response.code}"
puts response.body
exit(response.code.to_i.between?(200, 299) ? 0 : 1)
