export interface SuccessResponsePayload<T> {
  success: true;
  data: T;
  message: string;
}

export interface PaginatedResponsePayload<T> {
  success: true;
  data: T[];
  message: string;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export function successResponse<T>(
  data: T,
  message: string = 'Request successful',
): SuccessResponsePayload<T> {
  return {
    success: true,
    data,
    message,
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message: string = 'Request successful',
): PaginatedResponsePayload<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data,
    message,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
