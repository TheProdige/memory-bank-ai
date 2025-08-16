/**
 * E2E Tests for EchoVault
 * Comprehensive end-to-end testing scenarios
 */

import { test, expect, Page } from '@playwright/test'

// Helper functions
const uploadFile = async (page: Page, filePath: string) => {
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(filePath)
}

const waitForFileProcessing = async (page: Page) => {
  await page.waitForSelector('[data-testid="processing-complete"]', { timeout: 30000 })
}

test.describe('File Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Add authentication if needed
  })

  test('Upload → Preview → Copy → Close', async ({ page }) => {
    // Navigate to files page
    await page.click('[data-testid="nav-files"]')
    await expect(page).toHaveURL('/files')
    
    // Upload a file
    await uploadFile(page, 'tests/fixtures/sample-document.pdf')
    
    // Wait for upload to complete
    await waitForFileProcessing(page)
    
    // Verify file appears in list
    await expect(page.locator('[data-testid="file-item"]')).toContainText('sample-document.pdf')
    
    // Open preview
    await page.click('[data-testid="file-preview-button"]')
    await expect(page.locator('[data-testid="file-preview"]')).toBeVisible()
    
    // Copy content
    await page.click('[data-testid="copy-content-button"]')
    
    // Verify copy feedback
    await expect(page.locator('[data-testid="copy-success"]')).toBeVisible()
    
    // Close preview
    await page.click('[data-testid="close-preview-button"]')
    await expect(page.locator('[data-testid="file-preview"]')).not.toBeVisible()
  })

  test('File search and filtering', async ({ page }) => {
    await page.goto('/files')
    
    // Upload multiple files
    await uploadFile(page, 'tests/fixtures/document1.pdf')
    await uploadFile(page, 'tests/fixtures/image1.jpg')
    await waitForFileProcessing(page)
    
    // Test search
    await page.fill('[data-testid="search-input"]', 'document')
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="file-item"]')).toContainText('document1.pdf')
    
    // Clear search
    await page.fill('[data-testid="search-input"]', '')
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(2)
    
    // Test type filter
    await page.click('[data-testid="filter-images"]')
    await expect(page.locator('[data-testid="file-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="file-item"]')).toContainText('image1.jpg')
  })
})

test.describe('RAG Query Flow', () => {
  test('RAG query → sources → fallback quota', async ({ page }) => {
    await page.goto('/chat')
    
    // Upload a document first
    await uploadFile(page, 'tests/fixtures/knowledge-base.pdf')
    await waitForFileProcessing(page)
    
    // Perform RAG query
    await page.fill('[data-testid="chat-input"]', 'What is the main topic of the document?')
    await page.click('[data-testid="send-button"]')
    
    // Wait for response
    await page.waitForSelector('[data-testid="chat-response"]', { timeout: 30000 })
    
    // Verify sources are shown
    await expect(page.locator('[data-testid="source-citation"]')).toBeVisible()
    
    // Click on source
    await page.click('[data-testid="source-citation"]')
    await expect(page.locator('[data-testid="source-preview"]')).toBeVisible()
    
    // Test quota fallback (simulate quota exceeded)
    await page.route('**/ai-gateway', route => {
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: 'Quota exceeded' })
      })
    })
    
    // Try another query
    await page.fill('[data-testid="chat-input"]', 'Tell me more details')
    await page.click('[data-testid="send-button"]')
    
    // Verify fallback message
    await expect(page.locator('[data-testid="quota-exceeded"]')).toBeVisible()
    await expect(page.locator('[data-testid="local-fallback"]')).toBeVisible()
  })
})

test.describe('Local-only Mode', () => {
  test('No external calls in offline mode', async ({ page, context }) => {
    // Block all external requests
    await context.route('**/*', route => {
      const url = route.request().url()
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        route.continue()
      } else {
        route.abort()
      }
    })
    
    await page.goto('/')
    
    // Switch to local-only mode
    await page.click('[data-testid="settings-button"]')
    await page.click('[data-testid="local-only-toggle"]')
    await expect(page.locator('[data-testid="local-mode-indicator"]')).toBeVisible()
    
    // Upload and process file locally
    await page.goto('/files')
    await uploadFile(page, 'tests/fixtures/simple-text.txt')
    
    // Verify local processing
    await expect(page.locator('[data-testid="local-processing"]')).toBeVisible()
    await waitForFileProcessing(page)
    
    // Verify file was processed without external calls
    await expect(page.locator('[data-testid="file-item"]')).toContainText('simple-text.txt')
    await expect(page.locator('[data-testid="processing-method"]')).toContainText('Local')
  })
})

test.describe('Accessibility', () => {
  test('Keyboard navigation', async ({ page }) => {
    await page.goto('/files')
    
    // Test tab navigation
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'upload-button')
    
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'search-input')
    
    // Test Enter key on buttons
    await page.focus('[data-testid="upload-button"]')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-testid="file-dialog"]')).toBeVisible()
    
    // Test Escape key
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="file-dialog"]')).not.toBeVisible()
  })

  test('Screen reader compatibility', async ({ page }) => {
    await page.goto('/files')
    
    // Check ARIA labels
    await expect(page.locator('[data-testid="upload-button"]')).toHaveAttribute('aria-label')
    await expect(page.locator('[data-testid="search-input"]')).toHaveAttribute('aria-label')
    
    // Check live regions
    await expect(page.locator('[aria-live="polite"]')).toBeVisible()
    
    // Check focus management in dialogs
    await page.click('[data-testid="upload-button"]')
    await expect(page.locator('[data-testid="file-dialog"] :focus')).toBeVisible()
  })
})

test.describe('Performance', () => {
  test('Large file handling', async ({ page }) => {
    await page.goto('/files')
    
    // Monitor network and performance
    const responses: any[] = []
    page.on('response', response => responses.push(response))
    
    // Upload large file
    await uploadFile(page, 'tests/fixtures/large-document.pdf') // 10MB+
    
    // Verify chunked processing
    await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible()
    await waitForFileProcessing(page)
    
    // Verify no timeouts occurred
    const failedRequests = responses.filter(r => r.status() >= 400)
    expect(failedRequests).toHaveLength(0)
  })

  test('Virtual scrolling with many files', async ({ page }) => {
    await page.goto('/files')
    
    // Simulate many files
    await page.route('**/files', route => {
      const files = Array.from({ length: 1000 }, (_, i) => ({
        id: `file-${i}`,
        name: `document-${i}.pdf`,
        size: 1024 * (i + 1),
        type: 'application/pdf',
        created_at: new Date().toISOString()
      }))
      
      route.fulfill({
        status: 200,
        body: JSON.stringify({ data: files })
      })
    })
    
    await page.reload()
    
    // Verify virtual scrolling is working
    const visibleItems = page.locator('[data-testid="file-item"]')
    const itemCount = await visibleItems.count()
    
    // Should not render all 1000 items at once
    expect(itemCount).toBeLessThan(50)
    
    // Scroll and verify new items load
    await page.mouse.wheel(0, 5000)
    await page.waitForTimeout(100)
    
    const newItemCount = await visibleItems.count()
    expect(newItemCount).toBeGreaterThan(itemCount)
  })
})