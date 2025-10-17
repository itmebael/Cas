import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, code } = await req.json()

    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: 'Email and code are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Send email using Supabase's email service
    const { data, error } = await supabaseClient.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('SITE_URL')}/reset-password?code=${code}`
      }
    })

    if (error) {
      console.error('Error generating link:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Store the 6-digit code in database for verification
    const { error: insertError } = await supabaseClient
      .from('reset_codes')
      .insert([
        { 
          email: email, 
          code: code, 
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() 
        }
      ])

    if (insertError) {
      console.error('Error storing reset code:', insertError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Reset code sent successfully',
        code: code 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-reset-code function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})





