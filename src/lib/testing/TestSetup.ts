/**
 * Test setup utilities for EchoVault
 * Provides mocks, fixtures and setup for comprehensive testing
 */

import { vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Mock Supabase client
export const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    data: null,
    error: null
  })),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      download: vi.fn(),
      remove: vi.fn(),
      createSignedUrl: vi.fn()
    }))
  },
  auth: {
    getUser: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn()
  }
}

// Mock file system APIs
export const mockFileSystem = {
  File: class MockFile {
    constructor(public name: string, public size: number, public type: string) {}
    stream() { return new ReadableStream() }
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)) }
    text() { return Promise.resolve('') }
  },
  FileReader: class MockFileReader {
    readAsText = vi.fn()
    readAsArrayBuffer = vi.fn()
    readAsDataURL = vi.fn()
    onload = null
    onerror = null
    result = null
  }
}

// Test fixtures
export const testFixtures = {
  file: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'test-document.pdf',
    size: 1024000,
    type: 'application/pdf',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    user_id: 'user-123',
    path: 'files/test-document.pdf',
    metadata: {
      extractedText: 'Sample text content',
      pageCount: 5,
      language: 'fr'
    }
  },
  memory: {
    id: '456e7890-e89b-12d3-a456-426614174001',
    title: 'Test Memory',
    content: 'This is a test memory content',
    created_at: '2024-01-01T00:00:00Z',
    user_id: 'user-123',
    tags: ['test', 'memory'],
    embedding: new Array(384).fill(0.1)
  },
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
  }
}

// Setup and teardown
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks()
  
  // Mock global APIs
  global.File = mockFileSystem.File as any
  global.FileReader = mockFileSystem.FileReader as any
  
  // Mock intersection observer
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
  
  // Mock resize observer
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Test utilities
export const waitForAsyncOperations = () => 
  new Promise(resolve => setTimeout(resolve, 0))

export const createMockFile = (
  name: string = 'test.txt',
  content: string = 'test content',
  type: string = 'text/plain'
) => {
  const blob = new Blob([content], { type })
  return new File([blob], name, { type })
}

export const createMockEvent = (files: File[]) => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  dataTransfer: {
    files: {
      length: files.length,
      item: (index: number) => files[index],
      [Symbol.iterator]: function* () {
        for (const file of files) yield file
      }
    }
  }
})