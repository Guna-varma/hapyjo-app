-- Only Assistant Supervisor can assign drivers/operators to vehicles.
-- Head Supervisor allocates vehicles to sites (vehicles.site_id) only; driver–vehicle assignment is Assistant Supervisor only.
DROP POLICY IF EXISTS "Head supervisor write driver_vehicle_assignments" ON public.driver_vehicle_assignments;
