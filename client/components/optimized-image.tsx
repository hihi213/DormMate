"use client"

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  fallbackSrc?: string
  onError?: () => void
}

export function OptimizedImage({
  src,
  alt,
  width = 400,
  height = 300,
  className,
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  fallbackSrc,
  onError
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc)
      setHasError(false)
    } else {
      setHasError(true)
      onError?.()
    }
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  if (hasError) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-gray-100 text-gray-500",
          className
        )}
        style={{ width, height }}
      >
        <span className="text-sm">이미지를 불러올 수 없습니다</span>
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        priority={priority}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        onError={handleError}
        onLoad={handleLoad}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
      
      {isLoading && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{ width, height }}
        />
      )}
    </div>
  )
}

// 프로필 이미지 전용 컴포넌트
export function ProfileImage({
  src,
  alt,
  size = 40,
  className
}: {
  src: string
  alt: string
  size?: number
  className?: string
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("rounded-full object-cover", className)}
      fallbackSrc="/placeholder-user.jpg"
    />
  )
}

// 로고 이미지 전용 컴포넌트
export function LogoImage({
  src,
  alt,
  width = 120,
  height = 40,
  className
}: {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn("object-contain", className)}
      fallbackSrc="/placeholder-logo.png"
      priority
    />
  )
}

// 아이콘 이미지 전용 컴포넌트
export function IconImage({
  src,
  alt,
  size = 24,
  className
}: {
  src: string
  alt: string
  size?: number
  className?: string
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("object-contain", className)}
      fallbackSrc="/placeholder.svg"
    />
  )
}
