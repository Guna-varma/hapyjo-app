-- Add type-of-expense category: 'fuel' for fuel entries, or one of the general categories.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_category text
  CHECK (expense_category IS NULL OR expense_category IN (
    'fuel',
    'maintenance',
    'spare_parts',
    'operator_wages',
    'labour_cost',
    'machine_rental',
    'vehicle_rental',
    'tools_equipment',
    'food_allowance',
    'office_expense',
    'other'
  ));

COMMENT ON COLUMN public.expenses.expense_category IS 'Type of expense: fuel (fuel entries) or maintenance, spare_parts, operator_wages, labour_cost, machine_rental, vehicle_rental, tools_equipment, food_allowance, office_expense, other. Fuel is set by app for fuel entries; Add expense dropdown shows only the general categories.';
