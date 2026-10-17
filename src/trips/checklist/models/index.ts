export type ChecklistUser = {
  userId: string;
  username: string;
  name: string | null;
};

export type ChecklistItemResponse = {
  id: string;
  title: string;
  category: string | null;
  assignedTo: ChecklistUser | null;
  isChecked: boolean;
  checkedAt: Date | null;
  checkedBy: ChecklistUser | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChecklistResponse = {
  items: ChecklistItemResponse[];
  // progress over the whole checklist, regardless of filter
  total: number;
  checked: number;
};
