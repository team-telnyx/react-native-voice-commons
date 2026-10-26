require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name          = 'TelnyxReactNativeVoiceSdk'
  s.version       = package['version']
  s.summary       = package['description']
  s.homepage      = package['homepage']
  s.license       = package['license']
  s.author        = package['author']
  s.source        = { :git => package['repository']['url'], :tag => "voice-sdk-v#{s.version}" }
  s.platform      = :ios, '14.0'
  s.swift_version = '5.4'
  s.source_files  = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'React-Core'
end
