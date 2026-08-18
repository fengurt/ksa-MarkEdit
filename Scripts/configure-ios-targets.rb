#!/usr/bin/env ruby
# frozen_string_literal: true

require 'xcodeproj'

project_path = File.expand_path('../MarkEdit.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)

def add_local_dependency(project, owner, target)
  return if owner.dependencies.any? { |dependency| dependency.target == target }

  proxy = project.new(Xcodeproj::Project::Object::PBXContainerItemProxy)
  proxy.container_portal = project.root_object.uuid
  proxy.proxy_type = Xcodeproj::Constants::PROXY_TYPES[:native_target]
  proxy.remote_global_id_string = target.uuid
  proxy.remote_info = target.name
  dependency = project.new(Xcodeproj::Project::Object::PBXTargetDependency)
  dependency.name = target.name
  dependency.target = target
  dependency.target_proxy = proxy
  owner.dependencies << dependency
end

def add_package_product(project, target, product_name)
  existing = target.package_product_dependencies.find { |dependency| dependency.product_name == product_name }
  return existing if existing

  dependency = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
  dependency.product_name = product_name
  target.package_product_dependencies << dependency

  build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
  build_file.product_ref = dependency
  target.frameworks_build_phase.files << build_file
  dependency
end

def source_reference(group, path)
  group.files.find { |file| file.path == path } || group.new_file(path)
end

def resource_reference(project, path, file_type = nil)
  existing = project.files.find { |file| file.path == path }
  return existing if existing

  reference = project.main_group.new_file(path)
  reference.source_tree = 'SOURCE_ROOT'
  reference.last_known_file_type = file_type if file_type
  reference
end

def add_build_file(phase, reference, attributes: nil)
  existing = phase.files.find do |file|
    file.file_ref == reference || file.product_ref == reference
  end
  return existing if existing

  build_file = phase.add_file_reference(reference, true)
  build_file.settings = { 'ATTRIBUTES' => attributes } if attributes
  build_file
end

def configure_target(target, bundle_id:, plist:, entitlements:, product_name:, module_name:, skip_install:)
  target.build_configurations.each do |configuration|
    settings = configuration.build_settings
    settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES' if target.symbol_type == :app_extension
    settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon' unless target.symbol_type == :app_extension
    settings['CLANG_ENABLE_MODULES'] = 'YES'
    settings['CODE_SIGN_ENTITLEMENTS'] = entitlements
    settings['CODE_SIGN_STYLE'] = 'Automatic'
    settings['CURRENT_PROJECT_VERSION'] = '1'
    settings['DEVELOPMENT_TEAM'] = 'A64LJ32AZT'
    settings['GENERATE_INFOPLIST_FILE'] = 'NO'
    settings['INFOPLIST_FILE'] = plist
    settings['IPHONEOS_DEPLOYMENT_TARGET'] = '18.0'
    settings['MARKETING_VERSION'] = '0.1.0'
    settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
    settings['PRODUCT_MODULE_NAME'] = module_name
    settings['PRODUCT_NAME'] = product_name
    settings['SDKROOT'] = 'iphoneos'
    settings['SKIP_INSTALL'] = skip_install ? 'YES' : 'NO'
    settings['SUPPORTS_MACCATALYST'] = 'NO'
    settings['SWIFT_VERSION'] = '6.0'
    settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  end
end

unless project.main_group.files.any? { |file| file.path == 'KMDIOSCore' }
  reference = project.main_group.new_file('KMDIOSCore')
  reference.last_known_file_type = 'wrapper'
end

app = project.targets.find { |target| target.name == 'MarkEditIOS' }
unless app
  app = project.new_target(:application, 'MarkEditIOS', :ios, '18.0')
  app_group = project.main_group.new_group('MarkEditIOS', 'MarkEditIOS')
  sources_group = app_group.new_group('Sources', 'Sources')
  %w[KMDIOSApp.swift DocumentSession.swift ContentView.swift EditorHostView.swift].each do |name|
    add_build_file(app.source_build_phase, source_reference(sources_group, name))
  end

  resources_group = app_group.new_group('Resources', 'Resources')
  %w[Info.plist KMDIOS.entitlements].each { |name| source_reference(resources_group, name) }
  %w[Localizable.xcstrings Assets.xcassets].each do |name|
    add_build_file(app.resources_build_phase, source_reference(resources_group, name))
  end
end

share = project.targets.find { |target| target.name == 'KMDShareExtension' }
unless share
  share = project.new_target(:app_extension, 'KMDShareExtension', :ios, '18.0')
  share_group = project.main_group.find_subpath('MarkEditIOS/ShareExtension', true)
  share_group.path = 'ShareExtension'
  source = source_reference(share_group, 'ShareViewController.swift')
  source_reference(share_group, 'Info.plist')
  source_reference(share_group, 'KMDShareExtension.entitlements')
  add_build_file(share.source_build_phase, source)

  add_local_dependency(project, app, share)
  embed_phase = app.new_copy_files_build_phase('Embed App Extensions')
  embed_phase.dst_subfolder_spec = '13'
  add_build_file(embed_phase, share.product_reference, attributes: %w[CodeSignOnCopy RemoveHeadersOnCopy])
end

share_group = project.main_group.find_subpath('MarkEditIOS/ShareExtension', false)
share_group.path = 'ShareExtension' if share_group

add_package_product(project, app, 'MarkEditKit')
add_package_product(project, app, 'KMDIOSCore')
add_package_product(project, share, 'KMDIOSCore')

index = resource_reference(project, 'CoreEditor/dist/index.html', 'text.html')
chunks = resource_reference(project, 'CoreEditor/dist/chunks', 'folder')
add_build_file(app.resources_build_phase, index)
add_build_file(app.resources_build_phase, chunks)

configure_target(
  app,
  bundle_id: 'art.apuch.kmd.ios',
  plist: 'MarkEditIOS/Resources/Info.plist',
  entitlements: 'MarkEditIOS/Resources/KMDIOS.entitlements',
  product_name: 'kmd',
  module_name: 'KMDIOS',
  skip_install: false
)
configure_target(
  share,
  bundle_id: 'art.apuch.kmd.ios.share',
  plist: 'MarkEditIOS/ShareExtension/Info.plist',
  entitlements: 'MarkEditIOS/ShareExtension/KMDShareExtension.entitlements',
  product_name: 'KMDShareExtension',
  module_name: 'KMDShareExtension',
  skip_install: true
)

project.save

scheme_path = File.join(project_path, 'xcshareddata/xcschemes/MarkEditIOS.xcscheme')
unless File.exist?(scheme_path)
  scheme = Xcodeproj::XCScheme.new
  scheme.configure_with_targets(app, nil, launch_target: true)
  scheme.save_as(project_path, 'MarkEditIOS', true)
end
