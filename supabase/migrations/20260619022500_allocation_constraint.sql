-- Ensure no allocations currently exceed allocated_amount (cleanup if any dirty data exists)
UPDATE public.fund_allocations 
SET released_amount = allocated_amount 
WHERE released_amount > allocated_amount;

-- Add check constraint to enforce that released_amount cannot exceed allocated_amount
ALTER TABLE public.fund_allocations 
ADD CONSTRAINT check_released_within_allocated 
CHECK (released_amount <= allocated_amount);
