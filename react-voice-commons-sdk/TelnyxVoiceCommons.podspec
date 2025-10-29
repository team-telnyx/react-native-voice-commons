require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'TelnyxVoiceCommons'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.homepage       = package['homepage']
  s.license        = package['license']
  s.platforms      = { :ios => '13.0' }
  s.swift_version  = '5.4'
  s.author         = package['author']
  s.source         = { :git => package['repository']['url'], :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,swift}"
  s.requires_arc = true

  # Dependencies
  s.dependency 'React'
  s.dependency 'React-Core'
  
  # WebRTC Framework dependency
  s.dependency 'JitsiWebRTC', '~> 124.0.0'

  # iOS Frameworks
  s.frameworks = 'CallKit', 'PushKit', 'AVFoundation'

  # Compiler flags for Swift
  s.compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1'
end