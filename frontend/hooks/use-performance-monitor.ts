import React, { useEffect, useRef, useCallback } from 'react'

interface PerformanceMetrics {
  renderTime: number
  memoryUsage?: number
  interactionTime?: number
}

interface PerformanceOptions {
  enableMemoryTracking?: boolean
  enableInteractionTracking?: boolean
  threshold?: number
  onThresholdExceeded?: (metrics: PerformanceMetrics) => void
}

export function usePerformanceMonitor(
  componentName: string,
  options: PerformanceOptions = {}
) {
  const renderStartTime = useRef<number>(0)
  const interactionStartTime = useRef<number>(0)
  const metrics = useRef<PerformanceMetrics>({ renderTime: 0 })

  const startRenderTimer = useCallback(() => {
    renderStartTime.current = performance.now()
  }, [])

  const endRenderTimer = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current
    metrics.current.renderTime = renderTime

    // 메모리 사용량 추적
    if (options.enableMemoryTracking && 'memory' in performance) {
      const memory = (performance as any).memory
      metrics.current.memoryUsage = memory.usedJSHeapSize / 1024 / 1024 // MB
    }

    // 임계값 체크
    if (options.threshold && renderTime > options.threshold) {
      console.warn(`[${componentName}] 렌더링 시간이 ${options.threshold}ms를 초과했습니다: ${renderTime.toFixed(2)}ms`)
      options.onThresholdExceeded?.(metrics.current)
    }

    // 개발 환경에서 로깅
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${componentName}] 렌더링 시간: ${renderTime.toFixed(2)}ms`)
    }
  }, [componentName, options])

  const startInteractionTimer = useCallback(() => {
    if (options.enableInteractionTracking) {
      interactionStartTime.current = performance.now()
    }
  }, [options.enableInteractionTracking])

  const endInteractionTimer = useCallback(() => {
    if (options.enableInteractionTracking) {
      const interactionTime = performance.now() - interactionStartTime.current
      metrics.current.interactionTime = interactionTime

      if (process.env.NODE_ENV === 'development') {
        console.log(`[${componentName}] 상호작용 시간: ${interactionTime.toFixed(2)}ms`)
      }
    }
  }, [componentName, options.enableInteractionTracking])

  // 렌더링 성능 추적
  useEffect(() => {
    startRenderTimer()
    
    // 다음 프레임에서 렌더링 완료로 간주
    const timer = requestAnimationFrame(() => {
      endRenderTimer()
    })

    return () => cancelAnimationFrame(timer)
  })

  return {
    startInteractionTimer,
    endInteractionTimer,
    metrics: metrics.current,
    startRenderTimer,
    endRenderTimer
  }
}

// 컴포넌트 렌더링 최적화를 위한 래퍼
export function withPerformanceMonitor<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  options: PerformanceOptions = {}
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'
  
  const OptimizedComponent = React.forwardRef<any, T>((props, ref) => {
    const { startRenderTimer, endRenderTimer } = usePerformanceMonitor(displayName, options)
    
    useEffect(() => {
      startRenderTimer()
      const timer = requestAnimationFrame(() => {
        endRenderTimer()
      })
      return () => cancelAnimationFrame(timer)
    })

    return React.createElement(WrappedComponent, { ...(props as T), ref })
  })

  OptimizedComponent.displayName = `withPerformanceMonitor(${displayName})`
  
  return OptimizedComponent
}

// 번들 크기 분석
export function useBundleAnalyzer() {
  const analyzeBundle = useCallback(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const resources = performance
        .getEntriesByType('resource')
        .filter((entry): entry is PerformanceResourceTiming => typeof (entry as PerformanceResourceTiming).transferSize === "number")
      
      const bundleSize = resources
        .filter(resource => 
          resource.name.includes('.js') || 
          resource.name.includes('.css') ||
          resource.name.includes('chunk')
        )
        .reduce((total, resource) => total + resource.transferSize, 0)
      
      console.log('📦 번들 크기 분석:', {
        총_JS_CSS_크기: `${(bundleSize / 1024 / 1024).toFixed(2)}MB`,
        페이지_로드_시간: `${navigation.loadEventEnd - navigation.loadEventStart}ms`,
        DOM_완성_시간: `${navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart}ms`,
        리소스_수: resources.length
      })
    }
  }, [])

  return { analyzeBundle }
}

// 메모리 누수 감지
export function useMemoryLeakDetector() {
  const memorySnapshots = useRef<number[]>([])
  
  const takeSnapshot = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usedMemory = memory.usedJSHeapSize / 1024 / 1024
      memorySnapshots.current.push(usedMemory)
      
      // 최근 10개 스냅샷만 유지
      if (memorySnapshots.current.length > 10) {
        memorySnapshots.current.shift()
      }
      
      // 메모리 증가 패턴 감지
      if (memorySnapshots.current.length >= 5) {
        const recent = memorySnapshots.current.slice(-5)
        const trend = recent.every((val, i) => i === 0 || val >= recent[i - 1])
        
        if (trend && (recent[recent.length - 1] - recent[0]) > 10) {
          console.warn('⚠️ 메모리 누수 가능성 감지:', {
            초기_메모리: `${recent[0].toFixed(2)}MB`,
            현재_메모리: `${recent[recent.length - 1].toFixed(2)}MB`,
            증가량: `${(recent[recent.length - 1] - recent[0]).toFixed(2)}MB`
          })
        }
      }
    }
  }, [])

  const clearSnapshots = useCallback(() => {
    memorySnapshots.current = []
  }, [])

  return { takeSnapshot, clearSnapshots, memorySnapshots: memorySnapshots.current }
}
