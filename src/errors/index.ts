// eslint-disable-next-line max-classes-per-file
export const errors = {
  400: { message: "Bad Request" },
  401: { message: "Unauthorized" },
  403: { message: "Forbidden" },
  404: { message: "Not Found" },
  429: { message: "Too Many Requests" },
  500: { message: "Internal Server Error" },
} as const;

export type ErrorType = keyof typeof errors;
export type Errors = typeof errors;
export type ErrorsMessage = {
  [T in ErrorType]: Errors[T]["message"];
}[ErrorType];

export type Error = {
  status: ErrorType;
  message: ErrorsMessage | string;
};

export class HttpError extends Error {
  message: ErrorsMessage | string;

  constructor(
    public status: ErrorType,
    message?: string | null
  ) {
    super(errors[status].message);
    this.message = message || errors[status].message;
  }

  throwMessage() {
    return {
      message: this.message,
      status: this.status,
    };
  }
}

export class BadRequestError extends HttpError {
  constructor(message?: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message?: string) {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message?: string) {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message?: string) {
    super(404, message);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message?: string) {
    super(429, message);
  }
}

export class InternalServerError extends HttpError {
  constructor(message?: string) {
    super(500, message);
  }
}

export const getErrorStatus = (status: number): ErrorType => {
  switch (status) {
    case 400:
      return 400;
    case 401:
      return 401;
    case 403:
      return 403;
    case 404:
      return 404;
    case 429:
      return 429;
    case 500:
      return 500;
    default:
      return 500;
  }
};

export const throwHttpErrorFromStatus = (
  status: ErrorType | number,
  message?: string
) => {
  switch (status) {
    case 400:
      throw new BadRequestError(message);
    case 401:
      throw new UnauthorizedError(message);
    case 403:
      throw new ForbiddenError(message);
    case 404:
      throw new NotFoundError(message);
    case 429:
      throw new TooManyRequestsError(message);
    case 500:
      throw new InternalServerError(message);
    default:
      throw new InternalServerError(message);
  }
};

export const handleApiError = ({ error }: { error: unknown }) => {
  if (error instanceof BadRequestError) {
    const status = 400;
    const { message } = error;

    return { message, status };
  }

  if (error instanceof UnauthorizedError) {
    const status = 401;
    const { message } = error;

    return { message, status };
  }

  if (error instanceof ForbiddenError) {
    const status = 403;
    const { message } = error;

    return { message, status };
  }

  if (error instanceof NotFoundError) {
    const status = 404;
    const { message } = error;

    return { message, status };
  }

  if (error instanceof TooManyRequestsError) {
    const status = 429;
    const { message } = error;

    return { message, status };
  }

  if (error instanceof HttpError) {
    const { status, message } = error.throwMessage();

    return { message, status };
  }

  const status = 500;

  const { message } = errors[status];

  return { message, status };
};
