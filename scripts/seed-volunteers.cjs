'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { neon } = require('@neondatabase/serverless')

if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL is missing (.env.local)')
	process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

const FIRST_NAMES = [
	'Aarav', 'Vihaan', 'Aditya', 'Arjun', 'Rohan', 'Siddharth', 'Karan', 'Raj', 'Amit', 'Neeraj',
	'Priya', 'Ananya', 'Kavya', 'Neha', 'Sneha', 'Meera', 'Divya', 'Isha', 'Riya', 'Pooja',
]
const LAST_NAMES = [
	'Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Reddy', 'Iyer', 'Kapoor', 'Joshi', 'Malhotra',
	'Gupta', 'Agarwal', 'Mehta', 'Chopra', 'Nair', 'Menon', 'Rao', 'Desai', 'Shah', 'Kulkarni',
]
const MIDDLE_NAMES = ['', 'Kumar', 'Devi', 'Singh', 'Lal', 'Prasad', '']
const CITIES = ['Rohini', 'Dwarka', 'Pitampura', 'Noida', 'Gurgaon', 'Faridabad', 'Ghaziabad', 'Karol Bagh']
const STATES = ['Delhi', 'Uttar Pradesh', 'Haryana', 'Delhi', 'Uttar Pradesh']
const DISTRICTS = ['North West Delhi', 'South Delhi', 'Gautam Buddh Nagar', 'Gurugram', 'Faridabad']
const SEWA_CENTERS = ['YA Delhi North', 'YA Delhi South', 'YA NCR East', 'YA NCR West']
const SEWA_ZONES = ['Zone A', 'Zone B', 'Zone C', 'Zone D']
const QUALIFICATIONS = ['Graduate', 'Post Graduate', '12th Pass', 'Diploma', 'Professional Degree']
const PROFESSIONS = ['Software Engineer', 'Teacher', 'Doctor', 'Student', 'Business', 'Government Service', 'Homemaker', 'Retired']
const COMPANIES = ['TCS', 'Infosys', 'Local School', 'AIIMS', 'Self Employed', 'HCL', 'Freelance', '—']
const BLOOD_GROUPS = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-']

/**
 * @param {number} i 1..100
 */
function buildVolunteer(i) {
	const fn = FIRST_NAMES[(i - 1) % FIRST_NAMES.length]
	const ln = LAST_NAMES[(i - 1 + Math.floor(i / 11)) % LAST_NAMES.length]
	const mn = MIDDLE_NAMES[i % MIDDLE_NAMES.length]
	const fullName = mn ? `${fn} ${mn} ${ln}` : `${fn} ${ln}`
	const slug = `${fn}.${ln}${i}`
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9.]/g, '')
	const email = `${slug}@seed.volunteers.ya`
	const contact = `98765${String(43000 + i).padStart(5, '0')}`
	const altContact = `91234${String(41000 + i).padStart(5, '0')}`
	const whatsapp = contact
	const emergency = `98100${String(4000 + (i % 9000)).padStart(4, '0')}`
	const age = String(20 + (i % 40))
	const gender = i % 2 === 0 ? 'Female' : 'Male'
	const yob = 1985 + (i % 25)
	const dob = `${yob}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`
	const city = CITIES[i % CITIES.length]
	const state = STATES[i % STATES.length]
	const district = DISTRICTS[i % DISTRICTS.length]
	const pin = String(110000 + (i % 90))
	const house = 12 + (i % 180)
	const street = `Block ${(i % 12) + 1}`
	const area = ['Sector 7', 'Phase 2', 'Extension', 'Main Road', 'Colony'][i % 5]
	const permanentAddress = `${house}, ${street}, ${area}, ${city}`
	const commPin = pin
	const sewaCenter = SEWA_CENTERS[i % SEWA_CENTERS.length]
	const sewaZone = SEWA_ZONES[i % SEWA_ZONES.length]
	const qual = QUALIFICATIONS[i % QUALIFICATIONS.length]
	const profession = PROFESSIONS[i % PROFESSIONS.length]
	const company = COMPANIES[i % COMPANIES.length]
	const blood = BLOOD_GROUPS[i % BLOOD_GROUPS.length]
	const yearsYa = String(1 + (i % 12))
	const joinYear = 2015 + (i % 8)

	return {
		core: {
			user_id: `seed_volunteer_${i}`,
			full_name: fullName,
			first_name: fn,
			middle_name: mn || null,
			last_name: ln,
			photo_url: `https://i.pravatar.cc/150?u=seed-ya-vol-${i}`,
			email,
			ya_id: String(i),
			role: 'volunteer',
			qr_code_url: '',
			account_status: 'active',
		},
		data: {
			age,
			gender,
			date_of_birth: dob,
			marital_status: i % 3 === 0 ? 'Married' : 'Single',
			blood_group: blood,
			willing_blood_donation: i % 2 === 0 ? 'Yes' : 'No',
			image_remarks: '',
			image_saved_as: '',
			contact_number: contact,
			alternate_contact: altContact,
			whatsapp_number: whatsapp,
			emergency_contact: emergency,
			emergency_relationship: i % 2 === 0 ? 'Parent' : 'Spouse',
			preferred_communication: i % 2 === 0 ? 'WhatsApp' : 'Phone',
			languages_known: 'Hindi, English',
			email_id: email,
			permanent_address: permanentAddress,
			landmark: ['Near metro', 'Opposite park', 'Behind mandir', 'Main chowk'][i % 4],
			country: 'India',
			state,
			district,
			tehsil: city,
			city_town_village: city,
			post_office: `${city} HO`,
			pin_code: pin,
			permanent_center: sewaCenter,
			zone_permanent_center: sewaZone,
			permanent_address_remarks: '',
			same_as_permanent: 'Yes',
			communication_address: permanentAddress,
			communication_pincode: commPin,
			communication_remarks: '',
			sewa_center: sewaCenter,
			sewa_zone: sewaZone,
			if_initiated: 'Yes',
			initiated_by: 'Center Lead',
			date_of_initiation: `${joinYear}-06-15`,
			initiation_remarks: '',
			primary_sewa_permanent: 'Community kitchen',
			secondary_sewa_permanent: 'Events',
			other_sewa_permanent: '',
			primary_sewa_current: 'Community kitchen',
			secondary_sewa_current: 'Blood donation camp',
			other_sewa_current: '',
			sewa_area_delhi: city,
			highest_qualification: qual,
			graduation: qual === 'Graduate' || qual === 'Post Graduate' ? 'B.A./B.Sc./B.Tech' : '',
			graduation_secondary: 'CBSE',
			graduation_college: `University ${(i % 5) + 1}`,
			post_graduation: qual === 'Post Graduate' ? 'M.A./M.Sc.' : '',
			post_graduation_secondary: '',
			post_graduation_college: qual === 'Post Graduate' ? `PG College ${i % 3}` : '',
			professional_course: i % 4 === 0 ? 'CA Foundation' : '',
			occupation_category: i % 2 === 0 ? 'Private' : 'Public',
			profession,
			profession_business_name: profession === 'Self Employed' ? `${ln} Enterprises` : '',
			company_name: company,
			job_designation: profession === 'Student' ? 'Student' : 'Executive',
			special_skills: ['Driving', 'First aid', 'IT', 'Music'][i % 4],
			permanent_icard_status: i % 3 === 0 ? 'Issued' : 'Pending',
			miscellaneous: '',
			type_of_icard: 'Volunteer',
			icard_remarks: '',
			permanent_icard_request: i % 3 === 0 ? 'Approved' : 'Submitted',
			uniform: i % 2 === 0 ? 'T-Shirt L' : 'T-Shirt M',
			orientation_training: 'Completed',
			place_of_orientation: sewaCenter,
			date_of_joining: `${joinYear}-01-10`,
			orientation_date_remarks: '',
			years_in_ya: yearsYa,
			active_status: 'Active',
			active_status_updated_on: '2025-03-01',
			remarks: 'Seed data — dummy volunteer',
			ya_id_remarks: '',
			role_responsibility: i % 5 === 0 ? 'Team lead' : 'Volunteer',
			role_updated_on: '2025-01-15',
			registered_beone: i % 2 === 0 ? 'Yes' : 'No',
			sos_username: `ya_${slug.slice(0, 12)}`,
			beone_remarks: '',
			knows_car_driving: i % 3 === 0 ? 'Yes' : 'No',
			using_ya_event_app: 'Yes',
			sat_sandesh: 'Yes',
			social_media: i % 2 === 0 ? 'Instagram' : 'None',
			frontend_sewa_preference: 'Events',
			backend_sewa_preference: 'Admin support',
			availability: ['Weekends', 'Evenings', 'Flexible'][i % 3],
			sewa_timings: '4–6 hours / week',
			last_updated_sheet: '2025-04-01',
			data_updation_remarks: 'Bulk seed',
		},
		sensitive: {
			id_proof_type: 'Aadhaar',
			id_proof_remarks: 'Seed — not a real document',
			id_proof_saved_as: `aadhaar_seed_${i}.pdf`,
			admin_notes: '',
			background_check_status: i % 7 === 0 ? 'pending' : 'cleared',
			flag_status: 'none',
		},
	}
}

async function main() {
	let insertedCore = 0
	let updatedCore = 0
	let insertedData = 0
	let updatedData = 0
	let insertedSens = 0

	for (let i = 1; i <= 100; i++) {
		const { core, data, sensitive } = buildVolunteer(i)
		const {
			user_id: userId,
			full_name: fullName,
			first_name: firstName,
			middle_name: middleName,
			last_name: lastName,
			photo_url: photoUrl,
			email,
			ya_id: yaId,
			role,
			qr_code_url: qrCodeUrl,
			account_status: accountStatus,
		} = core

		const insCore = await sql`
			INSERT INTO profiles_core (
				user_id, full_name, first_name, middle_name, last_name, photo_url, email, ya_id, role, qr_code_url, account_status
			)
			SELECT ${userId}, ${fullName}, ${firstName}, ${middleName}, ${lastName}, ${photoUrl}, ${email}, ${yaId}, ${role}, ${qrCodeUrl}, ${accountStatus}
			WHERE NOT EXISTS (SELECT 1 FROM profiles_core pc WHERE pc.ya_id = ${yaId})
			RETURNING id
		`
		if (insCore.length > 0) insertedCore++

		const upCore = await sql`
			UPDATE profiles_core SET
				full_name = ${fullName},
				first_name = ${firstName},
				middle_name = ${middleName},
				last_name = ${lastName},
				photo_url = ${photoUrl},
				email = ${email},
				role = ${role},
				qr_code_url = ${qrCodeUrl},
				account_status = ${accountStatus},
				updated_at = NOW()
			WHERE user_id = ${userId}
			RETURNING id
		`
		if (upCore.length > 0) updatedCore++

		const dataCols = data
		const upData = await sql`
			UPDATE profiles_data SET
				age = ${dataCols.age},
				gender = ${dataCols.gender},
				date_of_birth = ${dataCols.date_of_birth},
				marital_status = ${dataCols.marital_status},
				blood_group = ${dataCols.blood_group},
				willing_blood_donation = ${dataCols.willing_blood_donation},
				image_remarks = ${dataCols.image_remarks},
				image_saved_as = ${dataCols.image_saved_as},
				contact_number = ${dataCols.contact_number},
				alternate_contact = ${dataCols.alternate_contact},
				whatsapp_number = ${dataCols.whatsapp_number},
				emergency_contact = ${dataCols.emergency_contact},
				emergency_relationship = ${dataCols.emergency_relationship},
				preferred_communication = ${dataCols.preferred_communication},
				languages_known = ${dataCols.languages_known},
				email_id = ${dataCols.email_id},
				permanent_address = ${dataCols.permanent_address},
				landmark = ${dataCols.landmark},
				country = ${dataCols.country},
				state = ${dataCols.state},
				district = ${dataCols.district},
				tehsil = ${dataCols.tehsil},
				city_town_village = ${dataCols.city_town_village},
				post_office = ${dataCols.post_office},
				pin_code = ${dataCols.pin_code},
				permanent_center = ${dataCols.permanent_center},
				zone_permanent_center = ${dataCols.zone_permanent_center},
				permanent_address_remarks = ${dataCols.permanent_address_remarks},
				same_as_permanent = ${dataCols.same_as_permanent},
				communication_address = ${dataCols.communication_address},
				communication_pincode = ${dataCols.communication_pincode},
				communication_remarks = ${dataCols.communication_remarks},
				sewa_center = ${dataCols.sewa_center},
				sewa_zone = ${dataCols.sewa_zone},
				if_initiated = ${dataCols.if_initiated},
				initiated_by = ${dataCols.initiated_by},
				date_of_initiation = ${dataCols.date_of_initiation},
				initiation_remarks = ${dataCols.initiation_remarks},
				primary_sewa_permanent = ${dataCols.primary_sewa_permanent},
				secondary_sewa_permanent = ${dataCols.secondary_sewa_permanent},
				other_sewa_permanent = ${dataCols.other_sewa_permanent},
				primary_sewa_current = ${dataCols.primary_sewa_current},
				secondary_sewa_current = ${dataCols.secondary_sewa_current},
				other_sewa_current = ${dataCols.other_sewa_current},
				sewa_area_delhi = ${dataCols.sewa_area_delhi},
				highest_qualification = ${dataCols.highest_qualification},
				graduation = ${dataCols.graduation},
				graduation_secondary = ${dataCols.graduation_secondary},
				graduation_college = ${dataCols.graduation_college},
				post_graduation = ${dataCols.post_graduation},
				post_graduation_secondary = ${dataCols.post_graduation_secondary},
				post_graduation_college = ${dataCols.post_graduation_college},
				professional_course = ${dataCols.professional_course},
				occupation_category = ${dataCols.occupation_category},
				profession = ${dataCols.profession},
				profession_business_name = ${dataCols.profession_business_name},
				company_name = ${dataCols.company_name},
				job_designation = ${dataCols.job_designation},
				special_skills = ${dataCols.special_skills},
				permanent_icard_status = ${dataCols.permanent_icard_status},
				miscellaneous = ${dataCols.miscellaneous},
				type_of_icard = ${dataCols.type_of_icard},
				icard_remarks = ${dataCols.icard_remarks},
				permanent_icard_request = ${dataCols.permanent_icard_request},
				uniform = ${dataCols.uniform},
				orientation_training = ${dataCols.orientation_training},
				place_of_orientation = ${dataCols.place_of_orientation},
				date_of_joining = ${dataCols.date_of_joining},
				orientation_date_remarks = ${dataCols.orientation_date_remarks},
				years_in_ya = ${dataCols.years_in_ya},
				active_status = ${dataCols.active_status},
				active_status_updated_on = ${dataCols.active_status_updated_on},
				remarks = ${dataCols.remarks},
				ya_id_remarks = ${dataCols.ya_id_remarks},
				role_responsibility = ${dataCols.role_responsibility},
				role_updated_on = ${dataCols.role_updated_on},
				registered_beone = ${dataCols.registered_beone},
				sos_username = ${dataCols.sos_username},
				beone_remarks = ${dataCols.beone_remarks},
				knows_car_driving = ${dataCols.knows_car_driving},
				using_ya_event_app = ${dataCols.using_ya_event_app},
				sat_sandesh = ${dataCols.sat_sandesh},
				social_media = ${dataCols.social_media},
				frontend_sewa_preference = ${dataCols.frontend_sewa_preference},
				backend_sewa_preference = ${dataCols.backend_sewa_preference},
				availability = ${dataCols.availability},
				sewa_timings = ${dataCols.sewa_timings},
				last_updated_sheet = ${dataCols.last_updated_sheet},
				data_updation_remarks = ${dataCols.data_updation_remarks},
				updated_at = NOW()
			WHERE user_id = ${userId}
			RETURNING id
		`

		if (upData.length > 0) {
			updatedData++
		} else {
			const insData = await sql`
			INSERT INTO profiles_data (
				user_id, age, gender, date_of_birth, marital_status, blood_group, willing_blood_donation,
				image_remarks, image_saved_as, contact_number, alternate_contact, whatsapp_number,
				emergency_contact, emergency_relationship, preferred_communication, languages_known, email_id,
				permanent_address, landmark, country, state, district, tehsil, city_town_village, post_office, pin_code,
				permanent_center, zone_permanent_center, permanent_address_remarks, same_as_permanent,
				communication_address, communication_pincode, communication_remarks, sewa_center, sewa_zone,
				if_initiated, initiated_by, date_of_initiation, initiation_remarks,
				primary_sewa_permanent, secondary_sewa_permanent, other_sewa_permanent,
				primary_sewa_current, secondary_sewa_current, other_sewa_current, sewa_area_delhi,
				highest_qualification, graduation, graduation_secondary, graduation_college,
				post_graduation, post_graduation_secondary, post_graduation_college, professional_course,
				occupation_category, profession, profession_business_name, company_name, job_designation, special_skills,
				permanent_icard_status, miscellaneous, type_of_icard, icard_remarks, permanent_icard_request,
				uniform, orientation_training, place_of_orientation, date_of_joining, orientation_date_remarks,
				years_in_ya, active_status, active_status_updated_on, remarks, ya_id_remarks,
				role_responsibility, role_updated_on, registered_beone, sos_username, beone_remarks,
				knows_car_driving, using_ya_event_app, sat_sandesh, social_media,
				frontend_sewa_preference, backend_sewa_preference, availability, sewa_timings,
				last_updated_sheet, data_updation_remarks
			) VALUES (
				${userId}, ${dataCols.age}, ${dataCols.gender}, ${dataCols.date_of_birth}, ${dataCols.marital_status}, ${dataCols.blood_group}, ${dataCols.willing_blood_donation},
				${dataCols.image_remarks}, ${dataCols.image_saved_as}, ${dataCols.contact_number}, ${dataCols.alternate_contact}, ${dataCols.whatsapp_number},
				${dataCols.emergency_contact}, ${dataCols.emergency_relationship}, ${dataCols.preferred_communication}, ${dataCols.languages_known}, ${dataCols.email_id},
				${dataCols.permanent_address}, ${dataCols.landmark}, ${dataCols.country}, ${dataCols.state}, ${dataCols.district}, ${dataCols.tehsil}, ${dataCols.city_town_village}, ${dataCols.post_office}, ${dataCols.pin_code},
				${dataCols.permanent_center}, ${dataCols.zone_permanent_center}, ${dataCols.permanent_address_remarks}, ${dataCols.same_as_permanent},
				${dataCols.communication_address}, ${dataCols.communication_pincode}, ${dataCols.communication_remarks}, ${dataCols.sewa_center}, ${dataCols.sewa_zone},
				${dataCols.if_initiated}, ${dataCols.initiated_by}, ${dataCols.date_of_initiation}, ${dataCols.initiation_remarks},
				${dataCols.primary_sewa_permanent}, ${dataCols.secondary_sewa_permanent}, ${dataCols.other_sewa_permanent},
				${dataCols.primary_sewa_current}, ${dataCols.secondary_sewa_current}, ${dataCols.other_sewa_current}, ${dataCols.sewa_area_delhi},
				${dataCols.highest_qualification}, ${dataCols.graduation}, ${dataCols.graduation_secondary}, ${dataCols.graduation_college},
				${dataCols.post_graduation}, ${dataCols.post_graduation_secondary}, ${dataCols.post_graduation_college}, ${dataCols.professional_course},
				${dataCols.occupation_category}, ${dataCols.profession}, ${dataCols.profession_business_name}, ${dataCols.company_name}, ${dataCols.job_designation}, ${dataCols.special_skills},
				${dataCols.permanent_icard_status}, ${dataCols.miscellaneous}, ${dataCols.type_of_icard}, ${dataCols.icard_remarks}, ${dataCols.permanent_icard_request},
				${dataCols.uniform}, ${dataCols.orientation_training}, ${dataCols.place_of_orientation}, ${dataCols.date_of_joining}, ${dataCols.orientation_date_remarks},
				${dataCols.years_in_ya}, ${dataCols.active_status}, ${dataCols.active_status_updated_on}, ${dataCols.remarks}, ${dataCols.ya_id_remarks},
				${dataCols.role_responsibility}, ${dataCols.role_updated_on}, ${dataCols.registered_beone}, ${dataCols.sos_username}, ${dataCols.beone_remarks},
				${dataCols.knows_car_driving}, ${dataCols.using_ya_event_app}, ${dataCols.sat_sandesh}, ${dataCols.social_media},
				${dataCols.frontend_sewa_preference}, ${dataCols.backend_sewa_preference}, ${dataCols.availability}, ${dataCols.sewa_timings},
				${dataCols.last_updated_sheet}, ${dataCols.data_updation_remarks}
			)
			RETURNING id
		`
			if (insData.length > 0) insertedData++
		}

		const sensIns = await sql`
			INSERT INTO profiles_sensitive (
				user_id, id_proof_type, id_proof_remarks, id_proof_saved_as, admin_notes, background_check_status, flag_status
			)
			SELECT ${userId}, ${sensitive.id_proof_type}, ${sensitive.id_proof_remarks}, ${sensitive.id_proof_saved_as},
				${sensitive.admin_notes}, ${sensitive.background_check_status}, ${sensitive.flag_status}
			WHERE NOT EXISTS (SELECT 1 FROM profiles_sensitive ps WHERE ps.user_id = ${userId})
			RETURNING id
		`
		if (sensIns.length > 0) insertedSens++
	}

	console.log(
		`Volunteer seed: profiles_core +${insertedCore} inserted, ${updatedCore} updated; profiles_data +${insertedData} inserted, ${updatedData} updated; profiles_sensitive +${insertedSens} inserted.`
	)
	console.log('Note: Re-running refreshes all fields for user_id seed_volunteer_1…100.')
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
