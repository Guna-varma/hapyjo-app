# Roles: strict flow (client)

## Terminology

- **Truck** → **Driver** (role: `driver_truck`). Never call machine users "driver".
- **Machine** → **Operator** (role: `driver_machine`). Always "Operator" in UI and reports.

## Who does what

### Head Supervisor

- **Allocates vehicles to sites** (one site → many vehicles). Use the **Vehicles** tab: edit each vehicle and set its **Site**. No in-app "Add vehicle"; vehicles come from website sync.
- Does **not** assign drivers/operators to vehicles. That screen is for Assistant Supervisor only.

### Assistant Supervisor

- **Assigns drivers and operators to vehicles** at each site. Use Dashboard → "Assign drivers & operators to vehicles". Only they can change who (driver/operator) uses which vehicle at a site.
- Sees only their assigned sites.

### Owner

- Sets **contract rate (RWF per m³) per site**. Each site has its own rate; revenue = sum over sites of (approved volume × site rate).
- Accountant sees **allocation and revenue per site**.

### Surveyor

- Enters **volume** (e.g. work volume in m³). Charge per unit = Owner’s contract rate for that site.

### Accountant

- Sees **per-site allocation** (budget, spent, revenue) and total revenue. Read-only; no mutate.

## DB

- **driver_vehicle_assignments**: only **Assistant Supervisor** can write (RLS). Head Supervisor policy was removed (migration `20250304100000_driver_vehicle_assignments_only_assistant_supervisor.sql`).
