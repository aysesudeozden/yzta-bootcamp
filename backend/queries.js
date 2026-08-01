import { sql } from './db.js';

// 1. Yeni Kullanıcı Oluşturma
export async function createUser(name, surname, email, passwordHash) {
    const result = await sql`
    INSERT INTO users (name, surname, email, password_hash)
    VALUES (${name}, ${surname}, ${email}, ${passwordHash})
    RETURNING id, name, surname, email, role, created_date;
  `;
    return result[0];
}

// 2. Haber / İddia Analizi Kaydetme
export async function saveFactCheck({ claim, status, confidenceScore, summary, claimsBreakdown, sources, checkedBy }) {
    const result = await sql`
    INSERT INTO fact_checks (
      claim, status, confidence_score, summary, claims_breakdown, sources, checked_by
    )
    VALUES (
      ${claim}, 
      ${status}, 
      ${confidenceScore}, 
      ${summary}, 
      ${claimsBreakdown}, 
      ${sources}, 
      ${checkedBy}
    )
    RETURNING *;
  `;
    return result[0];
}

// 3. Chat Mesajını Kaydetme
export async function saveChat(userId, message, response, model = 'gemini-2.5-flash') {
    const result = await sql`
    INSERT INTO chats (user_id, message, response, model)
    VALUES (${userId}, ${message}, ${response}, ${model})
    RETURNING *;
  `;
    return result[0];
}

// 4. Kullanıcının Chat Geçmişini Çekme
export async function getUserChats(userId) {
    return await sql`
    SELECT id, message, response, model, created_date
    FROM chats
    WHERE user_id = ${userId}
    ORDER BY created_date DESC;
  `;
}

// 5. Kullanıcı Doğrulama (Login)
export async function findUserByEmail(email) {
    const result = await sql`
    SELECT * FROM users WHERE email = ${email} LIMIT 1;
  `;
    return result[0];
}

// 6. Tüm Analiz Kayıtlarını Çekme (Admin)
export async function getAllFactChecks(adminId) {
    // Admin yetki kontrolü
    const admin = await sql`SELECT role FROM users WHERE id = ${adminId} AND role = 'admin'`;
    if (admin.length === 0) {
        return [];
    }

    // Düzeltme: Sütun adları netleştirildi ve created_at kullanıldı
    return await sql`
    SELECT 
      fc.id,
      fc.claim,
      fc.status,
      fc.confidence_score,
      fc.summary,
      fc.claims_breakdown,
      fc.sources,
      fc.created_at,
      u.name AS checker_name,
      u.surname AS checker_surname,
      u.email AS checker_email
    FROM fact_checks fc
    JOIN users u ON u.id = fc.checked_by
    ORDER BY fc.created_at DESC;
  `;
}