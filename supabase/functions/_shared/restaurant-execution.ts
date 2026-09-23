export type RestaurantExecutionTarget = 'pos' | 'kitchen';
export type RestaurantExecutionStatus = 'not_configured' | 'pending' | 'accepted' | 'failed';

export interface RestaurantExecutionTargetState {
  status: RestaurantExecutionStatus;
  adapter_id: string | null;
  external_id: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  error_code: string | null;
}

export interface RestaurantExecutionState {
  version: 1;
  pos: RestaurantExecutionTargetState;
  kitchen: RestaurantExecutionTargetState;
}

export interface RestaurantExecutionOrder {
  order_id: string;
  tenant_id: string;
  bot_id: string;
  customer_name: string;
  contact: string | null;
  items: unknown[];
  total_amount: number;
  currency: string;
  fulfillment: 'pickup' | 'delivery';
  delivery_address: string | null;
  notes: string | null;
}

export interface RestaurantExecutionSubmission {
  submission_id: string;
  external_id?: string | null;
}

export interface RestaurantExecutionVerification {
  status: 'pending' | 'accepted' | 'failed';
  external_id?: string | null;
  error_code?: string | null;
}

export interface RestaurantExecutionAdapter {
  id: string;
  target: RestaurantExecutionTarget;

  /**
   * Reicht die Bestellung an das Zielsystem ein.
   * Ein erfolgreicher Return bedeutet nur "Submission angenommen",
   * nicht, dass POS/Küche die Bestellung bereits akzeptiert haben.
   */
  submit(order: RestaurantExecutionOrder): Promise<RestaurantExecutionSubmission>;

  /**
   * Separate Verifikation. Nur dieses Ergebnis darf den Zustand
   * "accepted" setzen.
   */
  verify(
    order: RestaurantExecutionOrder,
    submission: RestaurantExecutionSubmission,
  ): Promise<RestaurantExecutionVerification>;
}

function emptyTarget(): RestaurantExecutionTargetState {
  return {
    status: 'not_configured',
    adapter_id: null,
    external_id: null,
    submitted_at: null,
    verified_at: null,
    error_code: null,
  };
}

export function initialRestaurantExecutionState(): RestaurantExecutionState {
  return {
    version: 1,
    pos: emptyTarget(),
    kitchen: emptyTarget(),
  };
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '').trim();
    if (code) return code.slice(0, 120);
  }
  return 'EXECUTION_FAILED';
}

export async function executeRestaurantTarget(
  adapter: RestaurantExecutionAdapter | null | undefined,
  order: RestaurantExecutionOrder,
): Promise<RestaurantExecutionTargetState> {
  if (!adapter) return emptyTarget();

  let submission: RestaurantExecutionSubmission;
  const submittedAt = new Date().toISOString();

  try {
    submission = await adapter.submit(order);
  } catch (error) {
    return {
      status: 'failed',
      adapter_id: adapter.id,
      external_id: null,
      submitted_at: submittedAt,
      verified_at: null,
      error_code: safeErrorCode(error),
    };
  }

  const pending: RestaurantExecutionTargetState = {
    status: 'pending',
    adapter_id: adapter.id,
    external_id: submission.external_id ?? null,
    submitted_at: submittedAt,
    verified_at: null,
    error_code: null,
  };

  try {
    const verification = await adapter.verify(order, submission);
    const verifiedAt = new Date().toISOString();

    if (verification.status === 'accepted') {
      return {
        ...pending,
        status: 'accepted',
        external_id: verification.external_id ?? pending.external_id,
        verified_at: verifiedAt,
      };
    }

    if (verification.status === 'failed') {
      return {
        ...pending,
        status: 'failed',
        external_id: verification.external_id ?? pending.external_id,
        verified_at: verifiedAt,
        error_code: verification.error_code?.slice(0, 120) || 'VERIFICATION_FAILED',
      };
    }

    return {
      ...pending,
      external_id: verification.external_id ?? pending.external_id,
      verified_at: verifiedAt,
    };
  } catch (error) {
    return {
      ...pending,
      status: 'failed',
      verified_at: new Date().toISOString(),
      error_code: safeErrorCode(error),
    };
  }
}

export async function executeRestaurantOrder(
  order: RestaurantExecutionOrder,
  adapters: {
    pos?: RestaurantExecutionAdapter | null;
    kitchen?: RestaurantExecutionAdapter | null;
  },
): Promise<RestaurantExecutionState> {
  const [pos, kitchen] = await Promise.all([
    executeRestaurantTarget(adapters.pos, order),
    executeRestaurantTarget(adapters.kitchen, order),
  ]);

  return {
    version: 1,
    pos,
    kitchen,
  };
}
