-- Expand the plant palette with species widely used in Indian landscape
-- practice — avenue/canopy trees, palms, flowering shrubs, groundcovers,
-- climbers, bamboo, turf, aquatics, xeriscape succulents, ferns and a few
-- sacred/aromatic plants and bedding annuals. This is generic reference
-- data (like the original 12 species), not tenant-scoped, so it applies to
-- every company using this database.
INSERT INTO public.plant_species
  (botanical_name, common_name, category, water_need, sunlight, soil_type, growth_rate, mature_height_m, maintenance_level, native_region) VALUES

-- Avenue / canopy trees
('Delonix regia','Gulmohar','tree','low','full_sun','well_drained_loam','fast',10,'low','Madagascar'),
('Millingtonia hortensis','Indian Cork Tree','tree','medium','full_sun','loam','fast',18,'low','South Asia'),
('Cassia fistula','Amaltas / Golden Shower Tree','tree','low','full_sun','any','medium',10,'low','South Asia'),
('Peltophorum pterocarpum','Copper Pod','tree','low','full_sun','well_drained_loam','fast',15,'low','Southeast Asia'),
('Lagerstroemia speciosa','Pride of India / Jarul','tree','medium','full_sun','loam','medium',15,'low','South & Southeast Asia'),
('Ficus religiosa','Peepal','tree','low','full_sun','any','fast',20,'medium','Indian Subcontinent'),
('Ficus benghalensis','Banyan','tree','low','full_sun','any','medium',20,'medium','Indian Subcontinent'),
('Terminalia catappa','Indian Almond','tree','medium','full_sun','sandy_loam','fast',15,'low','Tropical Asia'),
('Terminalia arjuna','Arjun Tree','tree','medium','full_sun','loam','medium',20,'low','India'),
('Polyalthia longifolia','Ashoka (False Ashoka)','tree','medium','full_sun','loam','medium',12,'low','India'),
('Mimusops elengi','Bakul / Spanish Cherry','tree','medium','full_sun','loam','slow',12,'medium','India'),
('Michelia champaca','Champa / Champak','tree','medium','partial_shade','acidic_loam','medium',15,'medium','South Asia'),
('Saraca asoca','Ashoka Tree','tree','medium','partial_shade','loam','slow',9,'medium','India'),
('Bauhinia purpurea','Kachnar / Orchid Tree','tree','low','full_sun','any','medium',8,'low','South & Southeast Asia'),
('Callistemon citrinus','Bottlebrush','tree','medium','full_sun','well_drained','medium',6,'low','Australia'),
('Pongamia pinnata','Karanj','tree','low','full_sun','any','medium',15,'low','India / Southeast Asia'),
('Cassia javanica','Pink Shower Tree','tree','low','full_sun','well_drained_loam','fast',12,'low','Southeast Asia'),
('Grevillea robusta','Silver Oak','tree','medium','full_sun','well_drained_loam','fast',18,'low','Australia'),
('Wrightia tinctoria','Sweet Indrajao','tree','low','full_sun','any','medium',9,'low','India'),
('Cordia sebestena','Geiger Tree / Scarlet Cordia','tree','low','full_sun','sandy_loam','medium',7,'low','Caribbean / Central America'),
('Spathodea campanulata','African Tulip Tree','tree','medium','full_sun','loam','fast',18,'medium','Tropical Africa'),
('Cinnamomum camphora','Camphor Tree','tree','medium','partial_shade','loam','slow',15,'medium','East Asia'),
('Nyctanthes arbor-tristis','Parijat / Night-flowering Jasmine','tree','medium','partial_shade','any','medium',8,'low','South Asia'),

-- Palms
('Roystonea regia','Royal Palm','palm','medium','full_sun','well_drained_loam','medium',20,'low','Cuba / Caribbean'),
('Areca catechu','Areca Nut Palm','palm','high','full_sun','loam','medium',15,'medium','Southeast Asia'),
('Dypsis lutescens','Golden Cane Palm','palm','medium','partial_shade','well_drained_loam','fast',6,'low','Madagascar'),
('Phoenix roebelenii','Pygmy Date Palm','palm','low','full_sun','sandy_loam','slow',3,'low','Southeast Asia'),
('Livistona chinensis','Chinese Fan Palm','palm','medium','partial_shade','loam','slow',10,'low','East Asia'),
('Washingtonia robusta','Mexican Fan Palm','palm','low','full_sun','sandy_loam','fast',20,'low','Mexico'),
('Cocos nucifera','Coconut Palm','palm','medium','full_sun','sandy_loam','medium',20,'medium','Indo-Pacific'),
('Borassus flabellifer','Palmyra Palm','palm','low','full_sun','sandy_loam','slow',20,'low','South Asia / Africa'),

-- Flowering shrubs
('Hibiscus rosa-sinensis','China Rose / Hibiscus','shrub','medium','full_sun','loam','fast',3,'medium','East Asia'),
('Duranta erecta','Golden Dewdrop','shrub','medium','full_sun','any','fast',3,'low','Central & South America'),
('Tecoma stans','Yellow Bells','shrub','low','full_sun','well_drained','fast',4,'low','Tropical Americas'),
('Thevetia peruviana','Yellow Oleander','shrub','low','full_sun','any','medium',5,'low','Central America'),
('Murraya paniculata','Orange Jasmine / Kamini','shrub','medium','full_sun','loam','medium',4,'medium','South & Southeast Asia'),
('Jatropha integerrima','Peregrina','shrub','low','full_sun','well_drained','medium',3,'low','Caribbean'),
('Clerodendrum inerme','Glory Bower','shrub','medium','full_sun','sandy_loam','fast',2.5,'low','Coastal South & Southeast Asia'),
('Acalypha wilkesiana','Copper Leaf','shrub','medium','full_sun','loam','fast',2.5,'medium','South Pacific'),
('Codiaeum variegatum','Croton','shrub','medium','partial_shade','loam','medium',2,'medium','Southeast Asia / Pacific'),
('Lantana camara','Lantana','shrub','low','full_sun','any','fast',1.5,'low','Tropical Americas'),
('Russelia equisetiformis','Coral / Firecracker Plant','shrub','low','full_sun','well_drained','medium',1.2,'low','Mexico'),
('Pentas lanceolata','Egyptian Star Cluster','shrub','medium','full_sun','loam','medium',0.9,'low','East Africa'),
('Cestrum nocturnum','Raat Ki Rani / Night-blooming Jasmine','shrub','medium','partial_shade','loam','fast',3,'low','Caribbean / Central America'),
('Calliandra haematocephala','Powder Puff','shrub','medium','full_sun','loam','medium',3,'low','South America'),
('Plumbago auriculata','Cape Leadwort','shrub','low','full_sun','well_drained','medium',2,'low','South Africa'),
('Ocimum tenuiflorum','Tulsi / Holy Basil','shrub','medium','full_sun','loam','fast',0.6,'low','Indian Subcontinent'),

-- Groundcovers
('Wedelia trilobata','Yellow Creeping Daisy','groundcover','medium','full_sun','any','fast',0.3,'low','Central America'),
('Tradescantia zebrina','Wandering Jew','groundcover','medium','partial_shade','loam','fast',0.2,'low','Central America'),
('Portulaca grandiflora','Moss Rose','groundcover','low','full_sun','sandy','fast',0.15,'low','South America'),
('Catharanthus roseus','Sadabahar / Vinca','groundcover','low','full_sun','any','fast',0.4,'low','Madagascar'),
('Alternanthera bettzickiana','Calico Plant','groundcover','medium','full_sun','loam','fast',0.25,'medium','South America'),
('Ophiopogon japonicus','Mondo Grass','groundcover','medium','partial_shade','loam','slow',0.2,'low','East Asia'),
('Trachelospermum jasminoides','Star Jasmine','groundcover','medium','partial_shade','well_drained_loam','medium',0.3,'low','East Asia'),
('Ipomoea pes-caprae','Beach Morning Glory','groundcover','low','full_sun','sandy','fast',0.2,'low','Pantropical coasts incl. India'),

-- Climbers
('Bougainvillea spectabilis','Climbing Bougainvillea','climber','low','full_sun','well_drained','fast',5,'low','South America'),
('Jasminum sambac','Mogra / Arabian Jasmine','climber','medium','full_sun','loam','medium',2,'medium','South Asia'),
('Petrea volubilis','Queen''s Wreath / Purple Wreath','climber','medium','full_sun','loam','medium',6,'medium','Central America'),
('Thunbergia grandiflora','Bengal Clock Vine / Sky Vine','climber','medium','partial_shade','loam','fast',6,'medium','India / Southeast Asia'),
('Antigonon leptopus','Coral Vine','climber','low','full_sun','well_drained','fast',8,'low','Mexico'),
('Allamanda cathartica','Golden Trumpet','climber','medium','full_sun','loam','fast',4,'medium','South America'),
('Quisqualis indica','Rangoon Creeper','climber','medium','full_sun','loam','fast',5,'medium','Southeast Asia'),

-- Bamboo
('Bambusa vulgaris','Common Bamboo','bamboo','medium','full_sun','any','fast',15,'low','Tropical Asia'),
('Bambusa multiplex','Hedge Bamboo','bamboo','medium','full_sun','loam','fast',5,'low','South China / Vietnam'),
('Dendrocalamus strictus','Male Bamboo / Lathi Bamboo','bamboo','low','full_sun','any','fast',12,'low','Indian Subcontinent'),

-- Turf
('Paspalum vaginatum','Seashore Paspalum','turf','medium','full_sun','sandy_loam','fast',0.1,'medium','Coastal Americas'),
('Axonopus compressus','Carpet Grass','turf','medium','partial_shade','loam','fast',0.1,'medium','Tropical Americas'),

-- Aquatic / pond
('Nelumbo nucifera','Lotus','aquatic','high','full_sun','wet_clay','medium',1,'medium','Asia (sacred in India)'),
('Nymphaea nouchali','Blue Star Water Lily','aquatic','high','full_sun','wet_clay','medium',0.3,'medium','South & Southeast Asia'),
('Pistia stratiotes','Water Lettuce','aquatic','high','full_sun','none','fast',0.2,'medium','South America'),
('Typha angustifolia','Cattail','aquatic','high','full_sun','wet_clay','fast',2,'low','Cosmopolitan wetlands'),

-- Succulents / xeriscape
('Agave americana','Century Plant','succulent','low','full_sun','sandy','slow',2,'low','Mexico'),
('Aloe vera','Aloe Vera','succulent','low','full_sun','sandy','medium',0.6,'low','Arabian Peninsula'),
('Euphorbia milii','Crown of Thorns','succulent','low','full_sun','well_drained','slow',1,'low','Madagascar'),
('Yucca gloriosa','Spanish Dagger','succulent','low','full_sun','sandy','slow',2,'low','Southeastern USA'),
('Opuntia ficus-indica','Prickly Pear Cactus','succulent','low','full_sun','sandy','medium',3,'low','Mexico'),

-- Ferns (shaded courts, water features)
('Nephrolepis exaltata','Boston Fern','fern','high','shade','loam','medium',0.6,'medium','Tropical Americas'),
('Adiantum capillus-veneris','Maidenhair Fern','fern','high','shade','loam','medium',0.3,'medium','Cosmopolitan'),

-- Seasonal bedding annuals
('Tagetes erecta','Marigold / Genda','annual','medium','full_sun','loam','fast',0.5,'medium','Mexico'),
('Cosmos bipinnatus','Cosmos','annual','low','full_sun','any','fast',0.9,'low','Mexico'),
('Zinnia elegans','Zinnia','annual','medium','full_sun','loam','fast',0.6,'medium','Mexico'),
('Celosia argentea','Cockscomb','annual','medium','full_sun','loam','fast',0.6,'medium','Tropical Asia / Africa')

ON CONFLICT (botanical_name) DO NOTHING;
