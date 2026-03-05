# Roles: strict flow (client)

## Terminology

- **Truck** → **Driver** (role: `driver_truck`). Never call machine users "driver".
- **Machine** → **Operator** (role: `driver_machine`). Always "Operator" in UI and reports.

## Who does what

### Head Supervisor

- **Allocates vehicles to sites** (one site → many vehicles). Use the **Vehicles** tab: edit each vehicle and set its **Site**. No in-app "Add vehicle"; vehicles come from website sync.
- Can also **assign drivers and operators to vehicles** at sites (same screen as Assistant Supervisor); RLS allows admin, head_supervisor, and assistant_supervisor to save driver/vehicle assignments (owner excluded).

### Assistant Supervisor

- **Assigns drivers and operators to vehicles** at each site. Use the site detail → trucks/machines assignment, or Dashboard → "Assign drivers & operators to vehicles". Sees only their assigned sites.
- Admin and head_supervisor can also save these assignments.

### Owner

- Sets **contract rate (RWF per m³) per site**. Each site has its own rate; revenue = sum over sites of (approved volume × site rate).
- Accountant sees **allocation and revenue per site**.

### Surveyor

- Enters **volume** (e.g. work volume in m³). Charge per unit = Owner’s contract rate for that site.

### Accountant

- Sees **per-site allocation** (budget, spent, revenue) and total revenue. Read-only; no mutate.

## DB

- **driver_vehicle_assignments**: **admin, head_supervisor, and assistant_supervisor** can write (owner excluded). See migration `20250307100000_driver_vehicle_assignments_allow_managers.sql`.
