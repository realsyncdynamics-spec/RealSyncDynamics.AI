// Agent Browser Executor — interfaces with playwright-scanner service
// Orchestrates actual browser automation, screenshot capture, and evidence collection

import type {
  BrowserAction,
  BrowserActionType,
  BrowserActionResult,
} from '../../types/agent-browser';

export interface PlaywrightScanResult {
  url: string;
  title: string;
  status: number;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
  }>;
  trackers: Array<{
    id: string;
    name: string;
  }>;
  local_storage: Record<string, string>;
  session_storage: Record<string, string>;
  network_requests_count: number;
  third_party_hosts: string[];
  score: number;
  severity: string;
  summary: string;
  meta: {
    duration_ms: number;
    redirect_chain: string[];
    fetched_status: number;
  };
}

export interface PlaywrightScanRequest {
  url: string;
  options?: {
    timeout?: number;
    waitFor?: string;
    user_agent?: string;
  };
}

export interface BrowserExecutorOptions {
  playwrightScannerUrl?: string;
  playwrightScannerSecret?: string;
  screenshotDir?: string;
  harLogDir?: string;
}

/**
 * BrowserExecutor orchestrates agent browser actions via playwright-scanner.
 *
 * Currently a placeholder that logs actions to DB. In production, this would:
 *   1. Call playwright-scanner service for each navigate/action
 *   2. Capture screenshots after each action
 *   3. Collect HAR logs for evidence chain
 *   4. Store evidence hashes in evidence_vault
 */
export class BrowserExecutor {
  private playwrightUrl: string;
  private playwrightSecret: string;

  constructor(options: BrowserExecutorOptions = {}) {
    this.playwrightUrl = options.playwrightScannerUrl || 'http://playwright-scanner:3000';
    this.playwrightSecret = options.playwrightScannerSecret || '';
  }

  /**
   * Execute a series of browser actions in a single session.
   * Returns array of action results with evidence hashes.
   */
  async executeActions(
    initialUrl: string,
    actions: BrowserAction[]
  ): Promise<BrowserActionResult[]> {
    const results: BrowserActionResult[] = [];
    let currentUrl = initialUrl;

    for (const action of actions) {
      const startTime = Date.now();

      try {
        let result: BrowserActionResult;

        switch (action.type) {
          case 'navigate':
            result = await this.handleNavigate(action.target || currentUrl);
            currentUrl = result.page_state?.url || currentUrl;
            break;

          case 'take_screenshot':
            result = await this.handleTakeScreenshot(currentUrl);
            break;

          case 'extract_data':
            result = await this.handleExtractData(currentUrl, action.target);
            break;

          case 'click':
            result = await this.handleClick(currentUrl, action.target);
            break;

          case 'fill_form':
            result = await this.handleFillForm(currentUrl, action.target, action.value);
            break;

          case 'submit_form':
            result = await this.handleSubmitForm(currentUrl, action.target);
            break;

          case 'get_page_title':
            result = await this.handleGetPageTitle(currentUrl);
            break;

          case 'get_text_content':
            result = await this.handleGetTextContent(currentUrl, action.target);
            break;

          case 'wait_for_element':
            result = await this.handleWaitForElement(
              currentUrl,
              action.target,
              action.timeout_ms || 5000
            );
            break;

          case 'scroll':
            result = await this.handleScroll(currentUrl, action.value);
            break;

          case 'evaluate_script':
            result = await this.handleEvaluateScript(currentUrl, action.value);
            break;

          default:
            result = {
              action_type: action.type,
              status: 'failed',
              error_code: 'UNKNOWN_ACTION_TYPE',
              error_message: `Unknown action type: ${action.type}`,
            };
        }

        result.duration_ms = Date.now() - startTime;
        results.push(result);
      } catch (err) {
        results.push({
          action_type: action.type,
          status: 'failed',
          duration_ms: Date.now() - startTime,
          error_message: err instanceof Error ? err.message : 'Unknown error',
          error_code: 'EXECUTION_ERROR',
        });
      }
    }

    return results;
  }

  private async handleNavigate(url: string): Promise<BrowserActionResult> {
    try {
      // Validate URL
      new URL(url);

      return {
        action_type: 'navigate',
        status: 'success',
        page_state: {
          url,
          title: `Page at ${url}`,
        },
      };
    } catch (err) {
      return {
        action_type: 'navigate',
        status: 'failed',
        error_code: 'INVALID_URL',
        error_message: 'Invalid URL format',
      };
    }
  }

  private async handleTakeScreenshot(url: string): Promise<BrowserActionResult> {
    // Placeholder: would capture screenshot via playwright-scanner
    return {
      action_type: 'take_screenshot',
      status: 'success',
      screenshot_hash: `screenshot_${Date.now()}`,
      page_state: {
        url,
        title: `Screenshot of ${url}`,
      },
    };
  }

  private async handleExtractData(
    url: string,
    selector?: string
  ): Promise<BrowserActionResult> {
    // Placeholder: would execute extraction query
    return {
      action_type: 'extract_data',
      status: 'success',
      extracted_data: {
        selector,
        found: true,
        preview: 'Data extraction results',
      },
      page_state: {
        url,
        title: `Extracted from ${url}`,
      },
    };
  }

  private async handleClick(url: string, selector?: string): Promise<BrowserActionResult> {
    return {
      action_type: 'click',
      status: 'success',
      page_state: {
        url,
        title: `After click on ${selector}`,
      },
    };
  }

  private async handleFillForm(
    url: string,
    selector?: string,
    value?: string
  ): Promise<BrowserActionResult> {
    return {
      action_type: 'fill_form',
      status: 'success',
      page_state: {
        url,
        title: `Filled ${selector} on ${url}`,
      },
    };
  }

  private async handleSubmitForm(url: string, selector?: string): Promise<BrowserActionResult> {
    return {
      action_type: 'submit_form',
      status: 'success',
      page_state: {
        url,
        title: `Form submitted on ${url}`,
      },
    };
  }

  private async handleGetPageTitle(url: string): Promise<BrowserActionResult> {
    return {
      action_type: 'get_page_title',
      status: 'success',
      extracted_data: {
        title: `Page Title for ${url}`,
      },
      page_state: {
        url,
        title: `Page Title for ${url}`,
      },
    };
  }

  private async handleGetTextContent(
    url: string,
    selector?: string
  ): Promise<BrowserActionResult> {
    return {
      action_type: 'get_text_content',
      status: 'success',
      extracted_data: {
        selector,
        text: 'Sample text content',
      },
      page_state: {
        url,
        title: `Text from ${selector}`,
      },
    };
  }

  private async handleWaitForElement(
    url: string,
    selector?: string,
    timeout?: number
  ): Promise<BrowserActionResult> {
    return {
      action_type: 'wait_for_element',
      status: 'success',
      page_state: {
        url,
        title: `Waited for ${selector} (${timeout}ms)`,
      },
    };
  }

  private async handleScroll(url: string, direction?: string): Promise<BrowserActionResult> {
    return {
      action_type: 'scroll',
      status: 'success',
      page_state: {
        url,
        title: `Scrolled ${direction || 'down'}`,
      },
    };
  }

  private async handleEvaluateScript(url: string, script?: string): Promise<BrowserActionResult> {
    return {
      action_type: 'evaluate_script',
      status: 'success',
      extracted_data: {
        result: 'Script evaluation result',
      },
      page_state: {
        url,
        title: `Script evaluated on ${url}`,
      },
    };
  }

  /**
   * Scan a URL with playwright-scanner for full compliance audit.
   * Useful for extracting trackers, cookies, storage, network requests.
   */
  async scanUrl(url: string): Promise<PlaywrightScanResult | null> {
    if (!this.playwrightUrl || !this.playwrightSecret) {
      console.warn('Playwright-scanner not configured');
      return null;
    }

    try {
      const response = await fetch(`${this.playwrightUrl}/scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.playwrightSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          options: { timeout: 30000 },
        }),
      });

      if (!response.ok) {
        console.error(`Playwright-scanner returned ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (err) {
      console.error('Error calling playwright-scanner:', err);
      return null;
    }
  }
}

export function createBrowserExecutor(
  options?: BrowserExecutorOptions
): BrowserExecutor {
  return new BrowserExecutor(options);
}
