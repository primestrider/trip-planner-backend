/**
 * Trip returned to clients.
 * Dates are formatted as YYYY-MM-DD.
 */
export type TripResponse = {
  id: string;
  title: string;
  destination: string;
  description: string | null;
  startDate: string;
  endDate: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TripListResponse = {
  items: TripResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
