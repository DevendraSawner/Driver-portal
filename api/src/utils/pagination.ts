export function pagination(pageInput: number, limitInput: number): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = pageInput;
  const limit = limitInput;
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
