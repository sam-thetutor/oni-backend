# Supabase Setup Guide for Oni Backend

## 🚀 **Step 1: Create Supabase Project**

1. Go to [supabase.com](https://supabase.com)
2. Sign up/Login and create a new project
3. Choose a name (e.g., "oni-backend")
4. Set a database password
5. Choose a region close to your users

## 🔧 **Step 2: Get Your Project Credentials**

1. Go to your project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

## 📝 **Step 3: Update Environment Variables**

Add these to your `backend/.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# For testnet (optional)
SUPABASE_URL_TESTNET=https://your-testnet-project.supabase.co
SUPABASE_ANON_KEY_TESTNET=your-testnet-anon-key-here
SUPABASE_SERVICE_ROLE_KEY_TESTNET=your-testnet-service-role-key-here
```

## 🗄️ **Step 4: Set Up Database Schema**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-migration.sql`
4. Click **Run** to execute the migration

## 🔐 **Step 5: Configure Row Level Security**

The migration script already sets up RLS policies, but you can verify them in:
- **Authentication** → **Policies**

## 🧪 **Step 6: Test the Connection**

Run the test script to verify everything works:

```bash
cd backend
npx tsx test-supabase-connection.js
```

## 📊 **Step 7: Monitor Your Database**

- **Table Editor**: View and edit data directly
- **Logs**: Monitor API requests and errors
- **Analytics**: Track database performance

## 🔄 **Migration from MongoDB**

If you have existing data in MongoDB, you can export it and import to Supabase:

1. Export MongoDB data as JSON
2. Use Supabase's **Table Editor** to import
3. Or create a migration script to transfer data

## 🚨 **Important Notes**

- **Service Role Key**: Keep this secret! Only use it server-side
- **Anon Key**: Safe to use in client-side code
- **RLS**: Row Level Security is enabled by default
- **Backups**: Supabase provides automatic backups

## 🆘 **Troubleshooting**

### Connection Issues
- Verify your project URL and keys
- Check if your IP is not blocked
- Ensure the project is not paused

### RLS Issues
- Verify policies are correctly set up
- Check if you're using the right key (anon vs service_role)
- Ensure user authentication is working

### Performance Issues
- Check the **Analytics** dashboard
- Monitor query performance
- Consider adding more indexes if needed 