alter table public.orders
  add constraint orders_customer_name_length check (char_length(customer_name) <= 100),
  add constraint orders_delivery_address_length check (char_length(delivery_address) <= 300),
  add constraint orders_customer_note_length check (char_length(customer_note) <= 500);
