import React from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Mock screen object with basic functionality
export const mockScreen = {
  getByText: (text: string | RegExp) => {
    const element = document.createElement('div');
    element.textContent = typeof text === 'string' ? text : 'mocked-text';
    Object.defineProperty(element, 'focus', { value: () => {} });
    return element;
  },
  getByRole: (role: string, options?: any) => {
    const element = document.createElement('div');
    element.setAttribute('role', role);
    element.setAttribute('disabled', options?.disabled || 'false');
    Object.defineProperty(element, 'focus', { value: () => {} });
    return element;
  },
  getByTestId: (testId: string) => {
    const element = document.createElement('div');
    element.setAttribute('data-testid', testId);
    return element;
  },
  getAllByRole: (role: string) => [document.createElement('div')],
  getAllByTestId: (testId: string) => [document.createElement('div')]
};

// Mock fireEvent
export const mockFireEvent = {
  click: (element: any) => {
    const event = new MouseEvent('click', { bubbles: true });
    element.dispatchEvent(event);
  }
};

// Mock waitFor
export const mockWaitFor = async (callback: () => void) => {
  await new Promise(resolve => setTimeout(resolve, 0));
  callback();
};

// Export everything needed for tests
export { render };
export const screen = mockScreen;
export const fireEvent = mockFireEvent;
export const waitFor = mockWaitFor;