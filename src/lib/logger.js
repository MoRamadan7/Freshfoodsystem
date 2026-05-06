import { supabase } from './supabase'

export async function logActivity(employee, actionType, entityName, entityId = null, details = '') {
  if (!employee) return

  // Log activity for all users to ensure complete oversight as requested
  // (Previously restricted to non-managers only)


  try {
    await supabase.from('activity_logs').insert({
      employee_id: employee.id,
      action_type: actionType,
      entity_name: entityName,
      entity_id: entityId ? String(entityId) : null,
      details: details
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}
