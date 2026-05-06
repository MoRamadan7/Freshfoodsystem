create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.employees (email, name, role)
  values (
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'موظف'
  );
  return new;
exception when others then
  -- In case the insert fails (e.g. missing required columns), we still allow the user to be created.
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
